var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {
        usernameLabel:cc.EditBox,
    },

    onLoginClick:function(){
        var self = this;
        pomelo.init({
            host:"127.0.0.1",
            port:3010
        }, function(err){
            pomelo.request("connector.entryHandler.login", {username:self.usernameLabel.string}, function(data){
                if (data.ret == 0) {
                    Comm.scene.login();
                }
            });
        });
    },
});
