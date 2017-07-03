var RoomData = require("../../commSrc/data/RoomData");
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
        var chair = RoomData.data.chr[this.serverIdx];
        if (chair == null) {
            this.node.active = false;
        } else {
            this.node.active = true;
            this.saySprite.node.active = (chair.pre == true);
        }
    },
    // 设置本地椅子号
    setLocalChairIndex : function(chairIndex) {
        // 本地椅子号
        this.localIdx = chairIndex;

        // 本地椅子号转服务器椅子号
        var serverChair = (RoomData.myChair + chairIndex)%5;
        this.serverIdx = serverChair;
        this.initUi();
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
