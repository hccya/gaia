'use strict';

/* global MozActivity, Applications */

(function(exports) {
  var ContextMenu = function() {
  };

  ContextMenu.prototype = {
    pinToHomeElem: document.getElementById('pin-to-home'),
    mainSection: document.getElementById('main-section'),
    removeElem: document.getElementById('remove-card'),
    contextMenuElem: document.getElementById('context-menu'),

    _appDeck: undefined,
    _app: undefined,

    init: function cm_init(appDeck) {
      this.mainSection.addEventListener('contextmenu',
        this.onContextMenu.bind(this));

      this._appDeck = appDeck;
      this._appDeck.on('focus-on-pinable', this.onFocusOnPinable.bind(this));
      this._appDeck.on('focus-on-nonpinable',
        this.onFocusOnNonpinable.bind(this));

      this.pinToHomeElem.addEventListener('click', this.pinOrUnpin.bind(this));
      this.removeElem.addEventListener('click', this.uninstall.bind(this));
    },

    _selfApp: undefined,

    _connectAndSend: function cm_sendMessage(message) {
      this._selfApp.connect('appdeck-channel').then(function (ports) {
        ports.forEach(function(port) {
          port.postMessage(message);
        });
      });
    },

    sendMessage: function cm_sendMessage(type, data) {
      var that = this;
      var message = {
        type: type,
        data: data
      };

      if (this._selfApp) {
        this._connectAndSend(message);
      } else {
        navigator.mozApps.getSelf().onsuccess = function(evt) {
          that._selfApp = evt.target.result;
          that._connectAndSend(message);
        }
      }
    },

    _composeLaunchURL: function cm_composeLaunchURL(app) {
      return app.manifestURL.replace('manifest.webapp', '') + app.entryPoint;
    },

    _sendUnpinMessage: function cm_sendUnpinActivity(app) {
      this.sendMessage('unpin', {
        name: app.name,
        manifestURL: app.manifestURL,
        launchURL: this._composeLaunchURL(app)
      });
    },

    pinOrUnpin: function cm_pinOrUnpin() {
      var that = this;

      if (this._app) {
        var app = this._app;
        if (app.pinned) {
          this._sendUnpinMessage(app);
        } else {
          // XXX: preferredSize should be determined by
          // real offsetWidth of cardThumbnailElem in smart-home instead of
          // hard-coded value
          Applications.getIconBlob(app.manifestURL, app.entryPoint, 354,
            function(blob) {
              new MozActivity({
                name: 'pin',
                data: {
                  name: app.name,
                  type: 'Application',
                  manifestURL: app.manifestURL,
                  launchURL: that._composeLaunchURL(app),
                  // We use app's original icon instead of screenshot here because
                  // we are in app deck. For the case of getting screenshot,
                  // please refer to bug 1100238.
                  thumbnail: blob
                }
              });
            });
        }
      }
    },

    uninstall: function cm_uninstall() {
      if (this._app && this._app.removable) {
        var app = this._app;
        // unpin app before uninstall it
        if (app.pinned) {
          this._sendUnpinMessage(app);
        }
        var appInstance = Applications.installedApps[app.manifestURL];
        if (appInstance) {
          navigator.mozApps.mgmt.uninstall(appInstance);
        }
      }
    },

    onFocusOnPinable: function cm_onFocusOnPinable(detail) {
      this._app = detail;
      // XXX: According to http://goo.gl/Spol9H, we should avoid using
      // mozL10n.get() as much as possible. But since system app use 'label'
      // to render menuitem, we are still using mozL10n.get here until we have
      // better way to resolve this
      var l10nId =
        (detail && detail.pinned) ? 'unpin-from-home' : 'pin-to-home';
      this.pinToHomeElem.label = navigator.mozL10n.get(l10nId);
      this.pinToHomeElem.setAttribute('data-l10n-id', l10nId);
      if (detail.removable === false) {
        this.contextMenuElem.removeChild(this.removeElem);
      } else {
        this.contextMenuElem.insertBefore(this.removeElem,
          this.pinToHomeElem.nextElementSibling);
      }
    },

    onFocusOnNonpinable: function cm_onFocusOnNonpinable() {
      this._app = undefined;
    },

    onContextMenu: function cm_onContextMenu(evt) {
      // stop showing context menu if we are not focus on pinable element
      if (!this._app) {
        evt.preventDefault();
      }
    }
  };

  exports.ContextMenu = ContextMenu;
})(window);
