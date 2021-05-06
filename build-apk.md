# Build APK

This documentation covers build an APK for The Well app that is based off [Moodle](https://moodle.org/).

## Requirements

In order to build the APK, you will need to be comfortable working on a terminal.  If you are familiar with it, then you will need to install [Node.js](https://nodejs.org/en/) on your computer.  It is best to use version **11.15.0**.  If you want to make managing Node.js versions easier, consider installing [NVM](https://github.com/nvm-sh/nvm#installing-and-updating). It will allow you to install and use any version of Node.js.  Once you install NVM, you can run the following commands to install the correct version:

```
nvm install 11.15.0
nvm use 11
```

You will also need to install [Android Studio](https://developer.android.com/studio/).  Once downloaded, make sure to download Android's SDK #29.  There is documentation [here](https://developer.android.com/about/versions/10/setup-sdk) that help you install it.

Now we need to install some build tools.  From terminal run the following commands:

```
npm install -g ionic cordova
```

Now we need to grab the code.  Change directory (**cd**) to the folder you store your code, and clone the repo.

```
git clone https://github.com/RT-coding-team/moodleapp.git .
```

Once you have the code, we want to get the right branch. Change directory (**cd**) to the folder it created.  Then change to the develop branch:

```
git checkout develop
```

Now let's set up the code.  We need to install the appropriate libraries:

```
npm install
npx cordova prepare
```

For some reason Cordova installs the wrong version of Android.  We need to downgrade the version. Run the following commands:

```
ionic cordova platform rm android
ionic cordova platform add android@8.1.0
```

You also need to change Build, Target, and Compile SDKs.  Open the file `platforms/android/build.gradle`.  Set the following variables correctly:

- defaultBuildToolsVersion = "29.0.0"
- defaultTargetSdkVersion = 29
- defaultCompileSdkVersion = 29

## Angular's AOT

Now we need to do some code changes in order to use [Angular's](https://angularjs.org/) AOT compiler.  If we do not do this, the app will fail to load on newer versions of Android.

First, open `node_modules/@angular/platform-browser-dynamic/esm5/platform-browser-dynamic.js`.  Search for the variable **_NO_RESOURCE_LOADER** (Around line #190).  You will see this code:

```
var _NO_RESOURCE_LOADER = {
    get: /**
     * @param {?} url
     * @return {?}
     */
    function (url) {
        throw new Error("No ResourceLoader implementation has been provided. Can't read the url \"" + url + "\"");
    }
};
```

We need to change it to:

```
var _NO_RESOURCE_LOADER = {
    get: /**
     * @param {?} url
     * @return {?}
     */
    function (url) {
        // throw new Error("No ResourceLoader implementation has been provided. Can't read the url \"" + url + "\"");
        url = 'templates/' + url;

        var resolve;
        var reject;
        var promise = new Promise(function (res, rej) {
            resolve = res;
            reject = rej;
        });
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'text';
        xhr.onload = function () {
            // responseText is the old-school way of retrieving response (supported by IE8 & 9)
            // response/responseType properties were introduced in ResourceLoader Level2 spec (supported by IE10)
            var response = xhr.response || xhr.responseText;
            // normalize IE9 bug (http://bugs.jquery.com/ticket/1450)
            var status = xhr.status === 1223 ? 204 : xhr.status;
            // fix status code when it is 0 (0 status is undocumented).
            // Occurs when accessing file resources or on Android 4.1 stock browser
            // while retrieving files from application cache.
            if (status === 0) {
                status = response ? 200 : 0;
            }
            if (200 <= status && status <= 300) {
                resolve(response);
            }
            else {
                reject("Failed to load " + url);
            }
        };
        xhr.onerror = function () { reject("Failed to load " + url); };
        xhr.send();
        return promise;
    }
};
```

Second, open this file: `node_modules/@ionic/app-scripts/dist/util/config.js`.  Locate the following code: (around line #48)

```
context.optimizeJs = [
    context.optimizeJs,
    context.isProd || hasArg('--optimizeJs')
]
```

Change it to:

```
context.optimizeJs = [
    context.optimizeJs,
    hasArg('--optimizeJs')
]
```

## Building Resources

Next we need to build the icon and splash screens.  Simply run the following command:

```
ionic cordova resources
```

## Building the APK

Now that you have completed that, you can build and compile the APK.  The commands below will load the app onto a mobile device if it is connected by USB.  You may want to us Android Studio to verify the device is really connected.  The phone must have developer options enabled, and allows USB debugging.  See [this article](https://developer.android.com/studio/debug/dev-options) for instructions on setting up your device.

Now to build the APK, run the following commands:

```
npm run ionic:build -- --prod
npx cordova run android
```

The first command takes significant amount of time to run.  So feel free and grab a cup of coffee.  You will see the path to the APK in the output of the last command.

Happy coding!
