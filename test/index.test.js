import feathers from 'feathers';
import memory from 'feathers-memory';
import authentication from 'feathers-authentication';
import openid, { Verifier } from '../src';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import Strategy from './fixtures/strategy';

chai.use(sinonChai);

describe('feathers-authentication-openid', () => {
  it('is CommonJS compatible', () => {
    expect(typeof require('../lib')).to.equal('function');
  });

  it('basic functionality', () => {
    expect(typeof openid).to.equal('function');
  });

  it('exposes the Verifier class', () => {
    expect(typeof Verifier).to.equal('function');
    expect(typeof openid.Verifier).to.equal('function');
  });

  describe('initialization', () => {
    let app;
    let config;
    let globalConfig;

    beforeEach(() => {
      config = {
        name: 'steam',
        Strategy,
        apiKey: '1234',
        realm: 'secret'
      };

      globalConfig = {
        secret: 'supersecret',
        steam: {
          apiKey: '1234',
          realm: 'secret'
        }
      };

      app = feathers();
      app.set('host', 'localhost');
      app.set('port', 3030);
      app.use('/users', memory());
      app.configure(authentication(globalConfig));
    });

    it('throws an error if passport has not been registered', () => {
      expect(() => {
        feathers().configure(openid());
      }).to.throw();
    });

    it('throws an error if strategy name is missing', () => {
      expect(() => {
        delete config.name;
        app.configure(openid(config));
      }).to.throw();
    });

    it('throws an error if Strategy is missing', () => {
      expect(() => {
        delete config.Strategy;
        app.configure(openid(config));
      }).to.throw();
    });

    it('throws an error if apiKey is missing', () => {
      expect(() => {
        delete config.apiKey;
        delete globalConfig.steam.apiKey;
        feathers().configure(authentication(globalConfig)).configure(openid(config));
      }).to.throw();
    });

    it('throws an error if realm is missing', () => {
      expect(() => {
        delete config.realm;
        delete globalConfig.steam.realm;
        feathers().configure(authentication(globalConfig)).configure(openid(config));
      }).to.throw();
    });

    it('registers the openid passport strategy', () => {
      sinon.spy(app.passport, 'use');
      sinon.spy(config, 'Strategy');
      app.configure(openid(config));
      app.setup();

      expect(config.Strategy).to.have.been.calledOnce;
      expect(app.passport.use).to.have.been.calledWith(config.name);

      app.passport.use.restore();
      config.Strategy.restore();
    });

    it('registers the strategy options', () => {
      sinon.spy(app.passport, 'options');
      app.configure(openid(config));
      app.setup();

      expect(app.passport.options).to.have.been.calledOnce;

      app.passport.options.restore();
    });

    describe('passport strategy options', () => {
      let authOptions;
      let args;

      beforeEach(() => {
        config.custom = true;
        sinon.spy(config, 'Strategy');
        app.configure(openid(config));
        app.setup();
        authOptions = app.get('authentication');
        args = config.Strategy.getCall(0).args[0];
      });

      afterEach(() => {
        config.Strategy.restore();
      });

      it('sets path', () => {
        expect(args.path).to.equal(`/auth/${config.name}`);
      });

      it('sets returnPath', () => {
        expect(args.returnPath).to.equal(`/auth/${config.name}/return`);
      });

      it('sets callbackURL', () => {
        expect(args.returnURL).to.equal(`http://localhost:3030/auth/${config.name}/return`);
      });

      it('sets idField', () => {
        expect(args.idField).to.equal(`${config.name}Id`);
      });

      it('sets entity', () => {
        expect(args.entity).to.equal(authOptions.entity);
      });

      it('sets service', () => {
        expect(args.service).to.equal(authOptions.service);
      });

      it('sets session', () => {
        expect(args.session).to.equal(true);
      });

      it('sets passReqToCallback', () => {
        expect(args.passReqToCallback).to.equal(authOptions.passReqToCallback);
      });

      it('supports setting custom options', () => {
        expect(args.custom).to.equal(true);
      });
    });

    it('mixes in global config for strategy', () => {
      delete config.apiKey;
      delete config.realm;
      sinon.spy(config, 'Strategy');

      app.configure(openid(config));
      app.setup();

      expect(config.Strategy.getCall(0).args[0].scope).to.deep.equal(['user']);

      config.Strategy.restore();
    });

    it('supports overriding default options', () => {
      sinon.spy(config, 'Strategy');
      config.entity = 'organization';
      app.configure(openid(config));
      app.setup();

      expect(config.Strategy.getCall(0).args[0].entity).to.equal('organization');

      config.Strategy.restore();
    });

    it('registers express get route', () => {
      sinon.spy(app, 'get');
      app.configure(openid(config));
      app.setup();

      expect(app.get).to.have.been.calledWith(`/auth/${config.name}`);

      app.get.restore();
    });

    it('registers express return route', () => {
      sinon.spy(app, 'get');
      app.configure(openid(config));
      app.setup();

      expect(app.get).to.have.been.calledWith(`/auth/${config.name}/return`);

      app.get.restore();
    });

    it('registers custom express return route', () => {
      sinon.spy(app, 'get');
      config.callbackPath = `/v1/api/auth/${config.name}/return`;
      app.configure(openid(config));
      app.setup();

      expect(app.get).to.have.been.calledWith(config.returnPath);

      app.get.restore();
    });

    describe('custom Verifier', () => {
      it('throws an error if a verify function is missing', () => {
        expect(() => {
          class CustomVerifier {
            constructor (app) {
              this.app = app;
            }
          }
          config.Verifier = CustomVerifier;
          app.configure(openid(config));
          app.setup();
        }).to.throw();
      });

      it('verifies through custom verify function', () => {
        const User = {
          email: 'admin@feathersjs.com',
          password: 'password'
        };

        const req = {
          query: {},
          body: Object.assign({}, User),
          headers: {},
          cookies: {}
        };
        class CustomVerifier extends Verifier {
          verify (req, identifier, profile, done) {
            expect(profile).to.deep.equal({ name: 'Mocky Mockerson' });
            done(null, User);
          }
        }

        config.Verifier = CustomVerifier;
        app.configure(openid(config));
        app.setup();

        return app.authenticate('steam')(req).then(result => {
          expect(result.data.user).to.deep.equal(User);
        });
      });
    });
  });
});
