var GameCardUi = require("./GameCardUi");
cc.Class({
    extends: cc.Component,

    properties: {
        saySprite:cc.Sprite,
        sayPrepare:cc.SpriteFrame,
        GameCardUiPrefab:cc.Prefab,
    },

    // use this for initialization
    onLoad: function () {

    },
    // 初始化ui
    initUi: function() {
        this.saySprite.node.active = false;
    },
    // 准备
    prepare:function(){
        this.saySprite.spriteFrame = this.sayPrepare;
        this.saySprite.node.active = true;
    },
    // 发牌
    dispatch:function(){
        this.saySprite.node.active = false;
        this.cardUi = cc.instantiate(this.GameCardUiPrefab);
        this.cardUi.parent = this.node;
        this.cardUi.x = 90;
    },
});
