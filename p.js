angular.module('P', [])
    .config(function ($provide) {
        $provide.decorator('$q', function ($delegate) {
            var _defer = $delegate.defer,
                _when = $delegate.when,
                _reject = $delegate.reject,
                _all = $delegate.all;

            $delegate.defer = function () {
                var deferred = _defer();
                decoratePromise(deferred.promise);
                return deferred;
            };

            $delegate.when = function () {
                var promise = _when.apply(this, arguments);
                return decoratePromise(promise);
            };

            $delegate.reject = function () {
                var promise = _reject.apply(this, arguments);
                return decoratePromise(promise);
            };

            $delegate.all = function () {
                var promise = _all.apply(this, arguments);
                return decoratePromise(promise);
            };

            $delegate.delay = function (value, ms) {
                if (arguments.length == 1) {
                    ms = value;
                    value = undefined;
                }

                return delay($delegate, ms, $delegate.when(value));
            };

            $delegate.any = function (promises) {
                return any($delegate, promises);
            };

            $delegate.allSettled = function (promises) {
                return allSettled($delegate, promises);
            };
            
            $delegate.join = function () {
                var passArgs = arguments;
                passArgs.unshift($delegate);
                return join.apply(void 0, passArgs);
            };
            
            $delegate.joinSettled = function () {
                var passArgs = arguments;
                passArgs.unshift($delegate);
                return joinSettled.apply(void 0, passArgs);
            };

            function decoratePromise(promise) {
                promise.inspect = function () {
                    return inspect(promise);
                };

                promise.isPending = function () {
                    return isPending(promise);
                };

                promise.isResolved = promise.isFulfilled = function () {
                    return isFulfilled(promise);
                };

                promise.isRejected = function () {
                    return isRejected(promise);
                };

                promise.spread = function (successCallback, errorCallback) {
                    return spread(promise, successCallback, errorCallback);
                };

                promise.timeout = function (ms) {
                    return timeout($delegate, promise, ms);
                };

                promise.delay = function (ms) {
                    return delay($delegate, ms, promise);
                };
                
                promise.any = function () {
                    var allPromises = arguments;
                    allPromises.unshift(promise);
                    return $delegate.any(allPromises);
                };
                
                promise.all = function () {
                    var allPromises = arguments;
                    allPromises.unshift(promise);
                    return $delegate.all(allPromises);
                };
                
                promise.allSettled = function () {
                    var allPromises = arguments;
                    allPromises.unshift(promise);
                    return $delegate.allSettled(allPromises);
                };
                
                promise.join = function () {
                    var allPromises = arguments;
                    allPromises.unshift(promise);
                    return $delegate.join.apply(void 0, allPromises);
                };
                
                promise.joinSettled = function () {
                    var allPromises = arguments;
                    allPromises.unshift(promise);
                    return $delegate.joinSettled.apply(void 0, allPromises);
                };
            }

            return $delegate;
        });

        function inspect(promise) {
            if (promise.$$state.status == -1)
                return { state: 'pending' };
            else if (promise.$$state.status == 1)
                return { state: 'fulfilled', value: promise.$$state.value };
            else if (promise.$$state.status == 2)
                return { state: 'rejected', reason: promise.$$state.value };
        }

        function isPending(promise) {
            return inspect(promise).state == 'pending';
        }

        function isFulfilled(promise) {
            return inspect(promise).state == 'fulfilled';
        }

        function isRejected(promise) {
            return inspect(promise).state == 'rejected';
        }

        function spread(promise, successCallback, errorCallback) {
            return promise.then(function (results) {
                return successCallback.apply(void 0, angular.isArray(results) ? results : [results]);
            }, errorCallback);
        }

        function timeout($qDelegate, promise, ms) {
            var deferred = $qDelegate.defer();

            var timeoutObj = setTimeout(function () {
                deferred.reject(new Error('Timed out after ' + ms + ' ms.'));
            }, ms);

            $qDelegate.when(promise).then(function (value) {
                deferred.resolve(value);
            }, function (reason) {
                deferred.reject(reason);
            }).finally(clearTimeout.bind(null, timeoutObj));

            return deferred.promise;
        }

        function delay($qDelegate, ms, promise) {
            var deferred = $qDelegate.defer();

            setTimeout(function () {
                $qDelegate.when(promise).then(function (value) {
                    deferred.resolve(value);
                }, function (reason) {
                    deferred.reject(reason);
                });
            }, ms);

            return deferred.promise;
        }

        function any($qDelegate, promises) {
            var deferred = $qDelegate.defer(),
                resolved = false,
                counter = 0,
                reasons = angular.isArray(promises) ? [] : {};

            angular.forEach(promises, function (promise, key) {
                counter++;
                $qDelegate.when(promise).then(function (value) {
                    if (!resolved) {
                        resolved = true;
                        deferred.resolve(value);
                    }
                }, function (reason) {
                    if (reasons.hasOwnProperty(key)) return;
                    reasons[key] = reason;
                    if (!(--counter)) deferred.reject(reasons);
                });
            });

            if (counter === 0) {
                deferred.reject(reasons);
            }

            return deferred.promise;
        }

        function allSettled($qDelegate, promises) {
            var deferred = $qDelegate.defer(),
                counter = 0,
                results = angular.isArray(promises) ? [] : {};

            angular.forEach(promises, function (promise, key) {
                counter++;
                $qDelegate.when(promise).finally(function (value) {
                    if (results.hasOwnProperty(key)) return;
                    results[key] = promise.inspect();
                    if (!(--counter)) deferred.resolve(results);
                });
            });

            if (counter === 0) {
                deferred.resolve(results);
            }

            return deferred.promise;
        }

        function join() {
            var $qDelegate = arguments[0],
                promises = arguments;
                
            promises.shift();

            var deferred = $qDelegate.defer(),
                counter = 0,
                results = [];

            angular.forEach(promises, function (promise, i) {
                counter++;
                $qDelegate.when(promise).then(function (value) {
                    if (results.hasOwnProperty(i)) return;
                    results[i] = value;
                    if (!(--counter)) deferred.resolve.apply(void 0, results);
                }, function (reason) {
                    if (results.hasOwnProperty(i)) return;
                    deferred.reject(reason);
                });
            });

            if (counter === 0) {
                deferred.resolve.apply(void 0, results);
            }

            return deferred.promise;
        }

        function joinSettled() {
            var $qDelegate = arguments[0],
                promises = arguments;
                
            promises.shift();

            var deferred = $qDelegate.defer(),
                counter = 0,
                results = [];

            angular.forEach(promises, function (promise, i) {
                counter++;
                $qDelegate.when(promise).finally(function (value) {
                    if (results.hasOwnProperty(i)) return;
                    results[i] = promise.inspect();
                    if (!(--counter)) deferred.resolve.apply(void 0, results);
                });
            });

            if (counter === 0) {
                deferred.resolve.apply(void 0, results);
            }

            return deferred.promise;
        }
    });
