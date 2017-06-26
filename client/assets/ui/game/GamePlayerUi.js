cc.Class({
    extends: cc.Component,

    properties: {
        saySprite:cc.Sprite,
        sayPrepare:cc.SpriteFrame,
    },

    // use this for initialization
    onLoad: function () {

    },

    // 准备
    prepare:function(){
        this.saySprite.spriteFrame = this.sayPrepare;
        this.saySprite.node.active = true;
        // this.saySprite.node.
    }
});
