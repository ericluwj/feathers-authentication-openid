# feathers-authentication-openid

[![Greenkeeper badge](https://badges.greenkeeper.io/feathersjs/feathers-authentication-openid.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/feathersjs/feathers-authentication-openid.png?branch=master)](https://travis-ci.org/feathersjs/feathers-authentication-openid)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-authentication-openid/badges/gpa.svg)](https://codeclimate.com/github/feathersjs/feathers-authentication-openid)
[![Test Coverage](https://codeclimate.com/github/feathersjs/feathers-authentication-openid/badges/coverage.svg)](https://codeclimate.com/github/feathersjs/feathers-authentication-openid/coverage)
[![Dependency Status](https://img.shields.io/david/feathersjs/feathers-authentication-openid.svg?style=flat-square)](https://david-dm.org/feathersjs/feathers-authentication-openid)
[![Download Status](https://img.shields.io/npm/dm/feathers-authentication-openid.svg?style=flat-square)](https://www.npmjs.com/package/feathers-authentication-openid)
[![Slack Status](http://slack.feathersjs.com/badge.svg)](http://slack.feathersjs.com)

> A Feathers OpenID authentication strategy

**This module is not published yet. It's awaiting further testing and cleanup and will then go out. If you are feeling adventurous you can use it by referencing `feathersjs/feathers-authentication-openid` in your `package.json`.**

## Installation

```
npm install feathers-authentication-openid --save
``` 
**Note:** This is only compatible with `feathers-authentication@1.x` and above.

## Documentation

Please refer to the [feathers-authentication-openid documentation](http://docs.feathersjs.com/) for more details.

## Supported Strategies

There aren't a ton of OpenID strategies anymore as most have moved to OAuth2, however this will work for any [Passport OpenID strategy](http://passportjs.org/). Most notably [Steam](https://github.com/liamcurry/passport-steam).

## API

This module contains 2 core pieces:

1. The main entry function
2. The `Verifier` class

### Main Initialization

In most cases initializing the `feathers-authentication-openid` module is as simple as doing this:

```js
const session = require('express-session');
const SteamStrategy = require('passport-steam').Strategy;
app.use(session({ secret: 'super secret', resave: true, saveUninitialized: true }));
app.configure(authentication(settings));
app.configure(openid({
  name: 'steam',
  Strategy: SteamStrategy,
  apiKey: '<your consumer key>',
  realm: '<your domain adress>'
}));
```
You can get your apiKey from [the steam community website](http://steamcommunity.com/dev/apikey).

This will set up session middleware and authentication pulling from your global `auth` object in your config file. It will also mix in the following defaults, which can be customized.

#### Default Options

```js
{
    idField: '<provider>Id', // The field to look up the entity by when logging in with the provider. Defaults to '<provider>Id' (ie. 'steamId').
    path: '/auth/<provider>', // The route to register the middleware
    returnPath: '/auth/<provider>/callback', // The route to register the callback handler
    returnURL: 'http(s)://hostame[:port]/auth/<provider>/return', // The callback url. Will automatically take into account your host and port and whether you are in production based on your app environment to construct the url. (ie. in development http://localhost:3030/auth/steam/return)
    entity: 'user', // the entity that you are looking up
    service: 'users', // the service to look up the entity
    passReqToCallback: true, // whether the request object should be passed to `verify`
    session: true // whether to use sessions,
    handler: function, // Express middleware for handling the openid return. Defaults to the built in middleware.
    formatter: function, // The response formatter. Defaults the the built in feathers-rest formatter, which returns JSON.
    Verifier: Verifier // A Verifier class. Defaults to the built-in one but can be a custom one. See below for details.
}
```

#### Feathers generator app config
If you have generated your application using the `feathers-cli` tool, you can add your configuration to the config json
```json
{
  "host": "localhost",
  "port": 3030,
  // ....
  "authentication": {
    // ...
    "steam": {
      "apiKey": "<your api key>",
      "realm": "<your domain address>",
      "successRedirect": "/"
    }
    // ...
  }
}
```

Additional passport strategy options can be provided based on the OpenID strategy you are configuring.

### Verifier

This is the verification class that handles the OpenID verification by looking up the entity (normally a `user`) on a given service and either creates or updates the entity and returns them. It has the following methods that can all be overridden. All methods return a promise except `verify`, which has the exact same signature as [passport-openid](https://github.com/jaredhanson/passport-openid).

```js
{
    constructor(app, options), // the class constructor
    _updateEntity(entity), // updates an existing entity
    _createEntity(entity), // creates an entity if they didn't exist already
    _normalizeResult(result), // normalizes result from service to account for pagination
    verify(req, identifier, profile, done) // queries the service and calls the other internal functions.
}
```

#### Customizing the Verifier

The `Verifier` class can be extended so that you customize it's behavior without having to rewrite and test a totally custom local Passport implementation. Although that is always an option if you don't want use this plugin.

An example of customizing the Verifier:

```js
import openid, { Verifier } from 'feathers-authentication-openid';

class CustomVerifier extends Verifier {
  // The verify function has the exact same inputs and
  // return values as a vanilla passport strategy
  verify(req, identifier, profile, done) {
    // do your custom stuff. You can call internal Verifier methods
    // and reference this.app and this.options. This method must be implemented.

    // the 'user' variable can be any truthy value
    done(null, user);
  }
}

app.configure(openid({
  name: 'steam',
  Strategy: SteamStrategy,
  apiKey: '<your api key>',
  realm: '<your domain address>',
  Verifier: CustomVerifier
}));
```

## Customizing The OpenID Response

Whenever you authenticate with an OpenID provider such as Steam, the provider sends back an `identifier` and a `profile` that contains the authenticated entity's information.

By default the `Verifier` takes everything returned by the provider and attaches it to the `entity` (ie. the user object) under the provider name. You will likely want to customize the data that is returned. This can be done by adding a `before` hook to both the `update` and `create` service methods on your `entity`'s service.

```js
app.configure(openid({
  name: 'steam',
  entity: 'user',
  service: 'users',
  Strategy,
  apiKey: '<your api key>',
  realm: '<your domain address>'
}));

function customizeSteamProfile() {
  return function(hook) {
    console.log('Customizing Steam Profile');
    // If there is a steam field they signed up or
    // signed in with steam so let's pull the users name.
    if (hook.data.steam) {
      hook.data.fullname = hook.data.steam.realname;
    }

    // If you want to do something whenever any OpenID
    // provider authentication occurs you can do this.
    if (hook.params.openid) {
      // do something for all OpenID providers
    }

    if (hook.params.openid.provider === 'steam') {
      // do something specific to the steam provider
    }

    return Promise.resolve(hook);
  };
}


app.service('users').hooks({
  before: {
    create: [customizeSteamProfile()],
    update: [customizeSteamProfile()]
  }
});
```

## Complete Example

Here's a basic example of a Feathers server that uses `feathers-authentication-openid`. You can see a fully working example in the [example/](./example/) directory.

**Note:** You must setup some session middleware. OpenID strategies rely on sessions in order to authenticate.

```js
const feathers = require('feathers');
const rest = require('feathers-rest');
const hooks = require('feathers-hooks');
const memory = require('feathers-memory');
const bodyParser = require('body-parser');
const session = require('express-session');
const SteamStrategy = require('passport-steam').Strategy;
const errorHandler = require('feathers-errors/handler');
const auth = require('feathers-authentication');
const openid = require('feathers-authentication-openid');

// Initialize the application
const app = feathers()
  .configure(rest())
  .configure(hooks())
  // Needed for parsing bodies (login)
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  // set up session support. This is required for OpenID strategies
  .use(session({ secret: 'super secret', resave: true, saveUninitialized: true }))
  // Configure feathers-authentication
  .configure(auth({ secret: 'super secret' }))
  .configure(openid({
    name: 'steam',
    Strategy: SteamStrategy,
    apiKey: '<your api key>',
    realm: '<your domain address>'
  }))
  .use('/users', memory())
  .use(errorHandler());

app.listen(3030);

console.log('Feathers app started on 127.0.0.1:3030');
```

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
