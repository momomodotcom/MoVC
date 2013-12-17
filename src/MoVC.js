/**
 * Copyright (C) 2013 momomo.com <opensource@momomo.com>
 *
 * Licensed under the GNU LESSER GENERAL PUBLIC LICENSE, Version 3, 29 June 2007;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.gnu.org/licenses/lgpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @Author Mohamed Seifeddine
 * @Author Philip Nilsson
 * @Author Magnus Ehdwall
 */
(function() {
        define ? define([], callback) : callback();

        function callback() {
                var MoJS = window.MoJS || (window.MoJS = {});
                MoJS.MoVC || (MoJS.MoVC = new MoVC());
                return MoVC;
        }

        function MoVC() {
                var that       = this;
                that.library   = 'MoVC';

                that.start     = start;
                that.stop      = stop;

                that.redirect  = redirect;
                that.forward   = forward;
                that.setHash   = setHash;

                that.urlCreate = urlCreate;
                that.urlSplit  = urlSplit;

                prototypeTrim();
                prototypeBind();

                var optionsGlobal = that.options = {
                        isProduction                : false,

                        path : {
                                app : {
                                        root        : "App/",
                                        controllers : "controllers/",
                                        services    : "services/"
                                }
                        },

                        route : {
                                "/" : undefined     // "start"
                        },

                        /**
                         * hashActivity
                         * Read
                         *
                         * https://developers.google.com/webmasters/ajax-crawling/docs/getting-started?hl=sv&csw=1
                         */

                        hashActivity       : "!",
                        actionCharsLeft    : "$",
                        actionCharsRight   : "$",

                        singleton : {
                                controllers : true,
                                services    : true,
                                other       : true
                        },

                        fileEnding       : require.isMoQR ? ".js" : '',
                        controllerEnding : "Controller",
                        serviceEnding    : "Service",
                        defaultAction    : "index",
                        onParams         : "request",

                        filters          : {
                                before     : [],
                                beforeView : [],
                                after      : []
                        }
                };

                // TODO Continue replacing string getters
                var CONTROLLER = "controller", ACTION = "action", ACTIONS = ACTION+"s",
                        HASHCHANGE     = "hashchange", ONHASHCHANGE = "on" + HASHCHANGE;

                var cacheClasses = {};
                var argsTrue = {
                        args: true
                };

                function start() {
                        startHashListener();
                        toHash();
                }

                function stop() {
                        stopHashListener();
                }

                function startHashListener() {
                        if ( window.attachEvent ) {
                                window.attachEvent(ONHASHCHANGE, toHash);
                        }
                        else if ( window.addEventListener ) {
                                window.addEventListener(HASHCHANGE, toHash, false);
                        }
                }
                function stopHashListener() {
                        if ( window.attachEvent ) {
                                window.detachEvent(ONHASHCHANGE, toHash);
                        }
                        else {
                                window.removeEventListener(HASHCHANGE, toHash, false);
                        }
                }

                function redirect(o) {
                        setHashPrivate( urlCreate.apply(this, arguments), true );
                }

                function forward(o) {
                        toURL( urlCreate.apply(this, arguments) );
                }

                function setHash(o) {
                        toHash.skipnext = true; // The hashlistener is on, so skip this next change

                        setHashPrivate( urlCreate.apply(this, arguments) , o.active)
                }

                function setHashPrivate(hash, bool) {
                        window.location.hash = bool ? optionsGlobal.hashActivity + hash : hash;
                }

                function toHash() {
                        if ( toHash.skipnext ) { delete toHash.skipnext; return; }

                        var hash = window.location.hash;
                        if ( hash ) {

                                if ( startsWith (hash, "#" + optionsGlobal.hashActivity ) ) {
                                        hash = hash.substring( 1 + optionsGlobal.hashActivity.length, hash.length );
                                        toURL(hash);
                                }
                        }

                        // Only if this is set and hash is empty
                        else if ( optionsGlobal.route["/"] ) {
                                toURL();
                        }

                }

                function urlCreate(o) {
                        if ( isString(o) ){
                                o = {
                                        controller : arguments[0],
                                        action     : arguments[1],
                                        params     : arguments[2],
                                        args       : Array.prototype.slice.call(arguments, 3, arguments.length)
                                };
                        }

                        if ( o.url ) {
                                return paramsAppend(o.url, o.params);
                        }
                        else if ( o[CONTROLLER] ) {
                                return urlCreateBase.apply(that, push([o[CONTROLLER], o[ACTION], o.params], o.args) );
                        }
                }

                /**
                 * @Returns a URI such as /controller/action/?.../aa/aa/aa
                 */
                function urlCreateBase(controller, action, params) {
                        var url = controller;
                        if ( action ) {
                                url += "/" + action
                        }

                        var paths = Array.prototype.slice.call(arguments, 3, arguments.length);
                        for ( var i in paths ) {
                                url += "/" + paths[i];
                        }

                        url = paramsAppend(url, params);

                        return url;
                }

                function urlSplit(url) {
                        var controller, action, params, args;

                        if ( url ) {
                                var slice    = url.split("?");
                                var paths    = slice[0].split("/");

                                controller = paths[0].slice(0, paths[0].length);
                                action     = paths[1];
                                args         = paths.slice(2, paths.length);

                                if ( slice.length > 1 ) {
                                        params = queryToParams( slice[1] );
                                }
                        }

                        return {
                                url          : url    || '',

                                args         : args   || [],
                                params       : params || {},

                                action       : action,
                                controller   : controller
                        }
                }

                /**
                 *  Invokes action for example on: /controller/action/arg1/arg2?a=1&b=2
                 */
                function toURL(url) {
                        var request = urlSplit(url);

                        /* ==========================================================
                         PROPERTIES ADDED TO REQUEST
                         {
                         controllerIn
                         actionIn
                         plugin
                         ControllerName               // "MyController"
                         ControllerPath               // ".../.../MyController.js"
                         ControllerClass              // MyController
                         controllerInstance           // new MyController()
                         promise

                         fnAction
                         fnBefore
                         fnBeforeView
                         fnAfter

                         MoVC               : that    // a reference to this instance of MoVC incase there are several
                         }
                         ========================================================== */

                        request.MoVC    = that;

                        // Consider prototyping these
                        request.fnBefore     = beforeFilters;
                        request.fnBeforeView = beforeViewFilters;
                        request.fnAfter      = afterFilters;

                        // Set controller and action defaults
                        request.urlIn        = url;
                        request.controllerIn = request[CONTROLLER];
                        request.actionIn     = request[ACTION];

                        var altered = false;
                        var rerouted;
                        if ( !request[CONTROLLER] ) {
                                rerouted = optionsGlobal.route["/"];

                                if ( rerouted ) {
                                        request[CONTROLLER] = rerouted;
                                        altered = true;
                                } else {
                                        exceptionThrow("You need to set the flag MoVC.options.route['/'] = '...'");
                                }
                        }

                        rerouted = optionsGlobal.route[request[CONTROLLER]];
                        if ( rerouted ) {
                                request[CONTROLLER] = rerouted;
                                altered = true;
                        }
                        if ( !request[ACTION] ) {
                                request[ACTION] = optionsGlobal.defaultAction;
                                altered = true;
                        }

                        requireControllerSimple(request[CONTROLLER], function(Class, name, path, plugin) {
                                request.plugin         = plugin;
                                request.ControllerName = name;
                                request.ControllerPath = path;

                                request.promise = getOrCreateController(Class, request.controllerIn).done(function() {
                                        request.ControllerClass = this.Class;
                                        request.controllerInstance     = this.instance;

                                        toAction(request, altered);
                                });

                        });
                }

                function toAction(request, altered) {
                        var actionFinalName = decorateAction( request[ACTION] );
                        request.fnAction    = request.controllerInstance[ actionFinalName ];

                        if ( request.fnAction ) {

                                if ( isString(request.fnAction) ) {
                                        request[ACTION] = request.fnAction;
                                        return toAction(request, true);
                                }

                                // Recreate the right url, so that filters matches appropiately to the action that is
                                // to be invoked when regexed with a url
                                if ( altered ) {
                                        request.url = urlCreate(request);
                                }

                                // Allow for reach of the filder + action so it can be reinvoked at will by developer
                                request.fnActionFiltered = fnActionFiltered;

                                // Prepare arguments here with proper parameters
                                request.arguments = [request.params];
                                request.arguments.push.apply (request.args);

                                fnActionFiltered.apply(request, request.arguments);
                        }
                        else {
                                exceptionThrow( str("The action '", actionFinalName, "' for requested action '"+ request.actionIn +"' does not exists in '", request.ControllerName, "'") );
                        }
                }


                function decorateAction(action) {
                        return optionsGlobal.actionCharsLeft + action + optionsGlobal.actionCharsRight;
                }


                function fnActionFiltered() {
                        var args = push([undefined], arguments);

                        // -- Before filters
                        var returns = beforeFilters.apply(this, args);
                        if (returns === false) return false;
                        if ( returns ) args[0] = returns;       // Pass on returns argument to next filter

                        // ==== Declare and call the actionMethod here! ===
                        returns = this.fnAction.apply(this, arguments);
                        if ( returns === false ) return false;

                        // -- After filters
                        returns = afterFilters.apply(this, args);
                        if ( returns === false ) return false;
                }

                function beforeFilters() {
                        return xFilters(this, "before", arguments);
                }

                function beforeViewFilters() {
                        return xFilters(this, "beforeView", arguments);
                }

                function afterFilters(args) {
                        return xFilters(this, "after", arguments);
                }

                function xFilters(request, x, args) {
                        var returns  = invokeFilters(request, optionsGlobal.filters[x], args);
                        if ( returns === false ) return false;
                        if ( returns ) args[0] = returns;       // Pass on returns argument to next filter

                        return invokeFilters(request, request.controllerInstance.filters[x], args)
                }

                function invokeFilters(request, filters, args) {
                        if ( filters ) {
                                for ( var i in filters ) {

                                        // IE8 fix
                                        if ( filters.hasOwnProperty(i) ) {
                                                var block = filters[i];

                                                if (    block &&

                                                        (
                                                                // To execute, this controller and action cannot be (false) present in exclude
                                                                hasRule(request, block.exclude) != true
                                                                        ||
                                                                        // Unless it is defined explicitly in include kyk
                                                                        hasRule(request, block.include) == true
                                                                )

                                                        ) {
                                                        var returns = block.filter.apply(request, args);
                                                        if ( returns === false || i == filters.length-1 ) {
                                                                return returns;         // If false or last - return
                                                        }
                                                        else if ( returns ) {
                                                                args[0] = returns;      // Pass on returns argument to next filter
                                                        }
                                                }
                                        }
                                }

                        }
                }

                /**
                 * Is this request defined in this rule block?
                 *
                 * Example: filterRuleDefined(request, block.exclude)
                 *
                 * If this controller and action is defined in exclude, then it will return true, otherwise false
                 *
                 */
                function hasRule(request, exclude) {

                        // Should we exclude this action from executing this filter?
                        if ( exclude && exclude.length > 0 ) {

                                for ( var j in exclude ) {
                                        var item = exclude[j];

                                        // A String => An url regexp
                                        if ( isString(item) ) {
                                                return item == '*' || matches(item, request.url );
                                        }

                                        // An Object = Better described
                                        else if ( item[CONTROLLER] == request[CONTROLLER] || item[CONTROLLER] == '*' ) {

                                                if ( item[ACTIONS] && item[ACTIONS].length > 0 ) {

                                                        for ( var k in item[ACTIONS] ) {
                                                                if ( item[ACTIONS][k] == request[ACTION] ) {
                                                                        return true;
                                                                }
                                                        }

                                                }

                                                // Apply for all if no actions defined
                                                else {
                                                        return true;
                                                }

                                        }
                                }

                        }

                        return false;
                }

                function ensureClassExtract(Class) {
                        Class.$extract$ || ( Class.$extract$ = functionExtract(Class) );
                }

                function isSingleton(klass, singleton) {
                        return klass.singleton === true || ( singleton === true && klass.singleton !== false);
                }

                function controllerOrService(name, fnController, fnService, fnOther) {
                        if ( !name ) return;

                        if ( endsWith(name, optionsGlobal.controllerEnding) ) {
                                return fnController();
                        }
                        else if ( endsWith(name, optionsGlobal.serviceEnding) )  {
                                return fnService();
                        }
                        else {
                                return fnOther();
                        }
                }


                // ----------------------------------------------------------------------

                /** simpleName == 'start' and not 'startController' **/
                function requireControllerSimple(simpleName, fn) {
                        return requireController(simpleName + optionsGlobal.controllerEnding, fn);
                }

                function requireController(name, fn) {
                        requireBase(optionsGlobal.path.app.controllers, name, fn);
                }

                function requireService(name, fn) {
                        requireBase(optionsGlobal.path.app.services, name, fn);
                }
                function requireOther(name, fn) {
                        requireBase(undefined, name, fn);
                }
                function requireDetermine(name, fn) {
                        controllerOrService(name, function() {
                                requireController(name, fn);
                        }, function() {
                                requireService(name, fn);
                        }, function() {
                                return requireOther(name, fn);
                        });
                }

                function requireBase(folder, file, fn) {
                        var split = pluginFileUpperCased(folder, file);
                        requireDynamic([split.file], function (Class) {
                                fn(Class, split.Name, split.file, split.plugin);
                        }, argsTrue);

                }

                function pluginFileUpperCased(folder, file) {
                        var split = pluginFile(folder, file, function(split) {
                                split.Name = split.file = upperCaseFirstLetter(split.file)
                        });

                        split.file += optionsGlobal.fileEnding;

                        return split;
                }
                // ----------------------------------------------------------------------


                // ----------------------------------------------------------------------
                function getOrCreateController(Class, cacheKey) {
                        ensureClassExtract(Class);

                        return getOrCreateBase(Class, cacheKey, optionsGlobal.singleton.controllers);
                }
                function getOrCreateService(Class, cacheKey) {
                        ensureClassExtract(Class);

                        return getOrCreateBase(Class, cacheKey, optionsGlobal.singleton.services);
                }

                function getOrCreateOther(Class, cacheKey) {
                        return getOrCreateBase(Class, cacheKey, optionsGlobal.singleton.other);
                }

                function getOrCreateClassDetermine(Class, cacheKey) {
                        ensureClassExtract(Class);

                        return controllerOrService(Class.$extract$.name, function() {
                                return getOrCreateController(Class, cacheKey);
                        }, function() {
                                return getOrCreateService(Class, cacheKey);
                        }, function() {
                                return getOrCreateOther(Class, cacheKey);
                        });
                }

                // ----------------------------------------------------------------------


                function getOrCreateBase(Class, cacheKey, singleton) {
                        var promise;
                        // Only one instance should be created, create it and cache it
                        if ( cacheKey && isSingleton(Class, singleton) ) {

                                promise = cacheClasses[cacheKey];
                                if ( !promise ) {
                                        promise = cacheClasses[cacheKey] = getOrCreateBasePromise(Class);
                                }
                        }

                        // Don't use cache
                        else {
                                promise = getOrCreateBasePromise(Class);
                        }

                        promiseResolveTry(promise); // If not locked, will resolve. Otherwise, the lockers take the responsibility to resolve

                        return promise;
                }

                function getOrCreateBasePromise(Class) {
                        var promiseParent   = $Promise();
                        promiseParent.Class = Class;

                        requireServices (promiseParent);
                        requireExtends  (promiseParent);

                        promiseParent.done(function() {
                                var args = [Class];
                                args.push.apply(args, promiseParent.serviceInstances);

                                // Note that if inherits or extends was set on class, newInstance will skip handling the superClass
                                // since requireExtendsLocking already have handled those references
                                promiseParent.instance = newInstance.apply(undefined, args);
                        });

                        return promiseParent;
                }

                /**
                 * This method is a special case where we try to load SEVERAL servies at once.
                 */
                function requireServices(promiseParent) {
                        var services, dependencies;

                        {       // ==== Prepare arguments for the require statement first ====
                                var spliced  = false;
                                services     = promiseParent.Class.$extract$.args;
                                dependencies = [];
                                for (var i = 0; i < services.length; i++) {
                                        var service = services[i] = services[i].trim();

                                        if ( endsWith(service, optionsGlobal.serviceEnding) ) {
                                                dependencies.push( pluginFileUpperCased(optionsGlobal.path.app.services, service).file );
                                        } else {
                                                // If not a service, then possibly something else we do not care about
                                                exceptionThrow("Error, the arguments only supports variables that ends with 'Service'!\n" +
                                                        "Argument number '" + i + "', ie: '"+service+"' does not!\n\n" +
                                                        "Class:\n\n" + promiseParent.Class.toString()
                                                )
                                        }

                                }
                        }

                        {       // ==== Require the prepared dependencies ====

                                var serviceInstances = promiseParent.serviceInstances = [];
                                if ( dependencies.length > 0 ) {
                                        promiseLock(promiseParent);

                                        requireDynamic(dependencies, function () {
                                                for ( var i = 0; i < arguments.length ; i++ ) {
                                                        promiseLock(promiseParent);

                                                        var promiseChild = getOrCreateService( arguments[i], services[i]);
                                                        promiseChild.i   = i;

                                                        promiseChild.done(function() {
                                                                serviceInstances[this.i] = this.instance;

                                                                promiseUnlockResolveTry (promiseParent);
                                                        });
                                                }

                                                promiseUnlockResolveTry (promiseParent);

                                        }, argsTrue);
                                }

                        }


                }

                function requireExtends(promiseParent) {
                        var subClass = promiseParent.Class;

                        if ( subClass && !subClass.hasOwnProperty("$superClass$") ) {
                                var superClass = subClass.inherits || subClass["extends"];

                                if ( superClass ) {
                                        if ( isString(superClass) ) {
                                                promiseLock(promiseParent);

                                                requireDetermine(superClass, function(zuperClass) {
                                                        requireExtendsStep2(promiseParent, subClass, zuperClass, superClass);
                                                });

                                        }
                                        // A class
                                        else if ( isClass(superClass) ) {
                                                promiseLock(promiseParent);

                                                // Use the class body as a cache key
                                                requireExtendsStep2(promiseParent, subClass, superClass, superClass.toString() );
                                        }
                                }
                        }
                }

                function requireExtendsStep2(promiseParent, subClass, superClass, cacheKey) {
                        var promiseChild = getOrCreateClassDetermine( superClass, cacheKey );

                        promiseChild.done(function() {
                                // The superInstance have been created at this stage and set on promiseChild.instance,
                                // grab it and set super references for subClass.
                                setSuperReferences(subClass, superClass, promiseChild.instance);

                                promiseUnlockResolveTry(promiseParent);
                        });
                }

                function promiseResolveTry(promise) {
                        if ( promise.lock == 0 && !promise.isResolved ) {
                                promise.resolve();
                        }
                }
                function promiseLock(promise) {
                        promise.lock++;
                }

                function promiseUnlockResolveTry(promise) {
                        promise.lock--;
                        promiseResolveTry(promise);
                }

                /**
                 * ========================================================================================
                 * Pay attention to context and intention usage
                 *
                 * 1. Using subInstance.methodInSuper() executes in the context of the subInstance
                 *
                 * 2. Using subInstance.$super$.methodInSuper() executes in the context of the superInstance
                 *
                 * Meaning that if both have this.val = 10; and a method in superInstance manipulates this value,
                 * then using the second case, this.val in the superInstance will be altered and not the one in the subInstance
                 *
                 * In the first case, the value of the subInstance will be manipulated. It is like you have replaced this.val in the superInstance.
                 *
                 * Most of the time, you want to be executing as in the first case. But if you are forced to call
                 *
                 *      subInstance.$super.$methodInSuper(),
                 *
                 * for instance when overloading methodInSuper in subInstance and calling it from within, then you should call
                 * the method as follows:
                 *
                 *      subInstance.$super$.methodInSuper.call(subInstance, arg1, arg2, arg3);
                 *
                 * This will execute it with the subInstance context and all methods and properties used in $super$.methodInSuper()
                 * will use your overloaded methods and properties in subInstance, similar to an abstract class behaves in Java.
                 *
                 * However, if you want the $super$.methodInSuper to use it's own implementation of everything, then you
                 * should execute as in the second case described above.
                 *
                 * A bit tricky, but welcome to the world of Javascript!
                 *
                 * To avoid such concerns, be careful when you are overloading methods and properties in a subClass.
                 * Again, most of the time, you want to be executing as in the first case.
                 *
                 * If you really want to take precautions, then always invoke methods in the superClass with
                 * a clear context, for instance:
                 *
                 *      // Same as 1. case
                 *      subInstance.$super$.methodInSuper.call(subInstance, arg1, arg2, arg3);
                 *              OR
                 *      // Same as 2. case
                 *      subInstance.$super$.methodInSuper.call(subInstance.$super$, arg1, arg2, arg3);
                 *
                 * Again, unless you know what you are doing, most of the time, you want to be executing as in the first case!
                 * Even when you have overloaded a method!
                 *
                 * Also note, the second case is a shared context between all instances of subClass.
                 * This is nearly impossible fact that you cannot get rid of in Javascript, unless paying and loosing other,
                 * more important features.
                 *
                 * Also important to observe!
                 * Normally the arguments for newInstance will bubble and be applied on the new SuperClass(...); as well,
                 * however in MoVC this is never called as we desire not to have the arguments bubble.
                 * If you do not want this to happen either, then you should call newInstance on your superClass in advance
                 * with desired arguments and use setSuperReferences(superInstance).
                 *
                 * ----------------------------------------------------------------------------------------
                 */
                function newInstance(subClass /** arg1, arg2, ... **/) {
                        if ( !subClass.hasOwnProperty("$superClass$") ) {
                                var superClass = subClass.inherits || subClass["extends"];

                                if (superClass) {

                                        // Ignore creating a new one if superClass is an instance
                                        if ( superClass.prototype ) {
                                                var args = Array.prototype.slice.call(arguments, 0);
                                                args[0]  = superClass;

                                                var superInstance = newInstance.apply(undefined, args);
                                        }

                                        // Already an instance
                                        else {
                                                superInstance = superClass;
                                                superClass    = undefined;
                                        }

                                        setSuperReferences(subClass, superClass, superInstance);
                                }

                        }

                        // Reference to own class
                        subClass.$class$ = subClass.prototype.$class$ = subClass;

                        return new (subClass.bind.apply(subClass, arguments))();
                }
                function setSuperReferences(subClass, superClass, superInstance) {
                        // ==== On prototype ====
                        subClass.prototype              = superInstance;
                        subClass.prototype.$superClass$ = superClass;
                        subClass.prototype.$super$      = superInstance;
                        // =======================


                        // ==== On class level ====
                        subClass.$superClass$ = superClass;

                        // We shouldn't really be adding this as it shouldn't be used from a Class.$super$ context
                        // But we are all grown ups and since it is available and shared, we will make it accessable.
                        // Liberal values ;)
                        subClass.$super$ = superInstance;
                        // =======================
                }



                // ======================================= MoXY ============================================
                // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


                function upperCaseFirstLetter(name) {
                        return name.substring(0, 1).toUpperCase() + name.substring(1);
                }

                function queryToParams(query) {
                        var params = {};
                        var keys  = query.split("&");
                        for (var i = 0; i < keys.length; i++) {
                                var pair = keys[i].split("=");
                                pair[0] = decodeURIComponent(pair[0]);
                                pair[1] = decodeURIComponent(pair[1]);

                                if ( params.hasOwnProperty(pair[0]) ) {
                                        if ( isArray(params[pair[0]]) ) {
                                                params[pair[0]].push(pair[1]);
                                        }
                                        else {
                                                params[pair[0]] = pair[1];
                                        }
                                } else {
                                        params[pair[0]] = [ params[pair[0]], pair[1] ];
                                }
                        }
                        return params;
                }

                function paramsToQuery(params) {
                        var query = "";
                        if (params) {
                                for (var key in params) {
                                        var val = params[key];
                                        if ( isArray(val) ) {
                                                for ( var i in val ) {
                                                        query += paramJoin(key, val[i]);
                                                }
                                        }
                                        else {
                                                query += paramJoin(key, val);
                                        }
                                }

                                if (query.length > 0) {
                                        query = query.substring(0, query.length - 1);  // Remove last '&'
                                }
                        }

                        return query;
                }

                function paramJoin(key, val){
                        return key + "=" + val + "&";
                }

                function paramsAppend(url, params) {
                        var query = paramsToQuery(params);
                        if (query) {
                                url += "?" + query;
                        }

                        return url;
                }


                function $Promise() {
                        var stack = [];
                        var lastfn = undefined;
                        var args = undefined;

                        var that = {
                                isPromise : true,

                                lock: 0,

                                done: function (fn) {
                                        if (args != undefined) {
                                                call(fn);
                                        } else {
                                                stack.push(fn);
                                        }

                                        return that;
                                },

                                last: function (fn) {
                                        if (lastfn != undefined) {
                                                throw "There can only be one last!";
                                        } else if (args != undefined) {
                                                call(fn);
                                        } else {
                                                lastfn = fn;
                                        }

                                        return that;
                                },

                                resolve: function () {
                                        if (stack != null) {
                                                that.isResolved = true;

                                                args = arguments;

                                                if (lastfn) {
                                                        stack.push(lastfn);
                                                }

                                                for (var i = 0; i < stack.length; i++) {
                                                        call(stack[i]);
                                                }
                                        }

                                        lastfn = null;
                                        stack  = null;

                                        return that;
                                },

                                isResolved: false
                        };

                        function call(fn) {
                                fn.apply(that, args);
                        }

                        return that;
                }

                function exceptionThrow(message) {
                        if ( !optionsGlobal.isProduction ) {
                                var line = exceptionHeader(that.library);
                                throw str(
                                        "\n",
                                        line,
                                        "\n", "Message:", "\n",
                                        message,
                                        "\n",
                                        line
                                );
                        }
                }

                function exceptionHeader(library) {
                        var lineArray = xChars(30, '=').split("");
                        lineArray.splice(parseInt(lineArray.length - 1) / 2 + 1, 0, " " + library + " Exception! "); // Push in the word ERROR in the middle
                        return lineArray.join("");
                }

                function str() {
                        return Array.prototype.join.call(arguments, "");
                }


                function xChars(i, iChar) {
                        var chars = "";
                        for ( ;i--; )  chars += iChar;
                        return chars;
                }

                function endsWith(str, s) {
                        return str.indexOf(s, str.length - s.length) !== -1;
                }

                function startsWith(str, s) {
                        return str.lastIndexOf(s, 0) === 0;
                }

                function matches(regexp, str) {
                        return new RegExp(regexp).test(str);
                }

                function isPrimitive(property) {
                        return typeof property  == "undefined" ||
                                typeof property == "boolean"   ||
                                typeof property == "number"    ||
                                typeof property == "string";

                        // The inverse:
                        // !(typeof (property == "object" && property != null)  || typeof property == "function")
                }

                /**
                 * Note! For performance reason, arguments are not trimmed! This can be done by the caller if args are used.
                 */
                var fn = "function";
                function functionExtract(func) {
                        var str = func.toString();

                        var bracketOpen = str.indexOf("{");
                        var bracketClose = str.lastIndexOf("}");
                        var body = str.substring(bracketOpen + 1, bracketClose);

                        var paranthesisClose = str.lastIndexOf(")", bracketOpen);
                        var paranthesisOpen  = str.lastIndexOf("(", paranthesisClose);
                        var args             = str.substring(paranthesisOpen + 1, paranthesisClose).split(/\s*,\s*/);
                        if ( args[0] == "" ) args = [];

                        var functionOpen  = str.lastIndexOf(fn, paranthesisOpen);
                        var functionClose = functionOpen + fn.length;
                        var name = str.substring( functionClose, paranthesisOpen).trim();
                        if ( !name || name.length == 0 ) name = undefined;

                        return {name:name, args:args, body:body};
                }


                var requireDynamic = window.MoJS && window.MoJS.MoQR ? requireMoQR : requireAMD;
                function requireMoQR(dependencies, fn, options) {
                        require.apply(require, arguments);
                }
                function requireAMD(dependencies, fn, options) {
                        Array.prototype.pop.call(arguments); // Remove options argument, require cannot handle it
                        require.apply(require, arguments);
                }

                var pluginLeft = "$", pluginRight = "$";
                function pluginSplit(str) {
                        if ( str && startsWith(str, pluginLeft) ) {
                                var i = str.indexOf( pluginRight, pluginLeft.length );
                                if ( ~i ) {
                                        return {
                                                plugin : str.substring ( pluginLeft.length, i ),
                                                file   : str.substring ( i+pluginRight.length )
                                        };
                                }
                        }
                        return {file: str};
                }

                function pluginFile(folder, file, fn) {
                        folder || (folder = "");

                        var split = pluginSplit(file);
                        fn && fn(split);
                        if ( !isAbsolutePath(split.file) ){
                                split.file = folder + split.file;

                                if ( !split.plugin ) {
                                        split.plugin = unslash(optionsGlobal.path.app.root);
                                }
                        }

                        split.file = split.plugin + "/" + split.file;

                        return split;
                }

                function isAbsolutePath(path) {
                        if ( !isAbsolutePath.regexp ) {
                                isAbsolutePath.regexp = new RegExp("^(?:/|.*://)");
                        }

                        return isAbsolutePath.regexp.test(path);
                }
                function unslash(str) {
                        if ( endsWith(str, "/")  ) {
                                return unslash( str.substring(0, str.length-1) );
                        }
                        return str;
                }

                function isString(o) {
                        return o.substring;
                }
                function isClass(o) {
                        return o.prototype;
                }

                function push(a, b) {
                        if ( b ) {
                                a.push.apply(a, b);
                        }
                        return a;
                }
                function isArray(o) {
                        return o.splice;
                }

                function prototypeTrim() {
                        String.prototype.trim || (String.prototype.trim = function() {
                                return this.replace(/^\s+|\s+$/g, '');
                        });
                }
                function prototypeBind() {
                        Function.prototype.bind || (Function.prototype.bind = function (that) {
                                var args   = Array.prototype.slice.call(arguments, 1);
                                var bind   = this;
                                var fn     = function () {};
                                var bindFn = function () {
                                        return bind.apply(this instanceof fn && that ? this : that, args.concat(Array.prototype.slice.call(arguments)) );
                                };

                                fn.prototype     = this.prototype;
                                bindFn.prototype = new fn();
                                return bindFn;
                        });
                }

        }
})();