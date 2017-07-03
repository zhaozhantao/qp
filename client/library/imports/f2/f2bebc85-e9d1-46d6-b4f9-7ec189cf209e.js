"use strict";

var Comm = require("../../commSrc/Comm");
var serverCfg = require("../../cfg/serverCfg");
cc.Class({
    extends: cc.Component,

    properties: {
        usernameLabel: cc.EditBox
    },

    onLoginClick: function onLoginClick() {
        var self = this;
        pomelo.init({
            host: serverCfg.serverIp,
            // host:"127.0.0.1",
            port: serverCfg.serverPort
        }, function (err) {
            pomelo.request("connector.entryHandler.login", { username: self.usernameLabel.string }, function (data) {
                if (data.ret == 0) {
                    Comm.scene.login();
                }
            });
        });
    }
});