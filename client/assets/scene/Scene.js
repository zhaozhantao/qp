var Comm = require("../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {
        loginUiPrefab:cc.Prefab,
        mainUiPrefab:cc.Prefab,
        gameUiPrefab:cc.Prefab,
    },

    // use this for initialization
    onLoad: function () {
        Comm.scene = this;
        this.loginUi = cc.instantiate(this.loginUiPrefab);
        this.loginUi.parent = this.node;
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
    login:function() {
        console.log("login");
        this.loginUi.destroy();
        this.loginUi = null;
        this.mainUi = cc.instantiate(this.mainUiPrefab);
        this.mainUi.parent = this.node;
    },
    enterRoom:function() {
        console.log("enterRoom");
        this.mainUi.destroy();
        this.mainUi = null;
        this.gameUi = cc.instantiate(this.gameUiPrefab);
        this.gameUi.parent = this.node;
    },
});
