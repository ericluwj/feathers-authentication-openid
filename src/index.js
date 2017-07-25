import Debug from 'debug';
import url from 'url';
import auth from 'feathers-authentication';
import { formatter as defaultFormatter } from 'feathers-rest';
import { omit, pick, makeUrl } from 'feathers-commons';
import merge from 'lodash.merge';
import defaultHandler from './express/handler';
import DefaultVerifier from './verifier';

const debug = Debug('feathers-authentication-openid');

const INCLUDE_KEYS = [
  'entity',
  'service',
  'passReqToCallback'
];

const EXCLUDE_KEYS = ['Verifier', 'Strategy', 'formatter'];

export default function init (options = {}) {
  return function openidAuth () {
    const app = this;
    const _super = app.setup;

    if (!app.passport) {
      throw new Error(`Can not find app.passport. Did you initialize feathers-authentication before feathers-authentication-openid?`);
    }

    let { name, Strategy } = options;

    if (!name) {
      throw new Error(`You must provide a strategy 'name'.`);
    }

    if (!Strategy) {
      throw new Error(`You must provide a passport 'Strategy' instance.`);
    }

    const authSettings = app.get('authentication') || {};

    // Attempt to pull options from the global auth config
    // for this provider.
    const providerSettings = authSettings[name] || {};
    const openidSettings = merge({
      idField: `${name}Id`,
      path: `/auth/${name}`,
      session: true,
      __oauth: true
    }, pick(authSettings, ...INCLUDE_KEYS), providerSettings, omit(options, ...EXCLUDE_KEYS));

    // Set callback defaults based on provided path
    openidSettings.returnPath = openidSettings.returnPath || `${openidSettings.path}/return`;
    openidSettings.returnURL = openidSettings.returnURL || makeUrl(openidSettings.returnPath, app);

    if (!openidSettings.apiKey) {
      throw new Error(`You must provide a 'apiKey' in your authentication configuration or pass one explicitly`);
    }

    if (!openidSettings.realm) {
      throw new Error(`You must provide a 'realm' in your authentication configuration or pass one explicitly`);
    }

    const Verifier = options.Verifier || DefaultVerifier;
    const formatter = options.formatter || defaultFormatter;
    const handler = options.handler || defaultHandler(openidSettings);

    // register OAuth middleware
    debug(`Registering '${name}' Express OpenID middleware`);
    app.get(openidSettings.path, auth.express.authenticate(name));
    app.get(
      openidSettings.returnPath,
      // NOTE (EK): We register failure redirect here so that we can
      // retain the natural express middleware redirect ability like
      // you would have with vanilla passport.
      auth.express.authenticate(name, openidSettings),
      handler,
      auth.express.emitEvents(authSettings),
      auth.express.setCookie(authSettings),
      auth.express.successRedirect(),
      auth.express.failureRedirect(authSettings),
      formatter
    );

    app.setup = function () {
      let result = _super.apply(this, arguments);
      let verifier = new Verifier(app, openidSettings);

      if (!verifier.verify) {
        throw new Error(`Your verifier must implement a 'verify' function. It should have the same signature as a OpenID passport verify callback.`);
      }

      // Register 'openid' strategy with passport
      debug('Registering openid authentication strategy with options:', openidSettings);
      app.passport.use(name, new Strategy(openidSettings, verifier.verify.bind(verifier)));
      app.passport.options(name, openidSettings);

      return result;
    };
  };
}

// Exposed Modules
Object.assign(init, {
  Verifier: DefaultVerifier
});
