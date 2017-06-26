module.exports = {
    data : {
        someRoomId:{
            // 所有座位信息
            chr:[
                {
                    // uid
                    uid:"1",
                    // 身上的金币
                    og:100000,
                    // 当前花费了的金币
                    cg:1000,
                    // 是否已经准备，对于准备阶段，代表是否已经点了准备
                    // 对于游戏进行阶段，代表是否参与了游戏
                    pre:true,
                    // 牌
                    card:[[1,2],[1,2],[1,2]],
                    // 是否已看牌
                    look:true,
                    // 是否已弃牌
                    gu:false,
                },
                null,
                null,
                null,
                null
            ],
            // 当前发言人
            s:0,
            // 当前发言人开始发言时间
            st:14501274324,
            // 池子总金币
            tg:10000,
            // 当前单注
            sg:1000,
            // 当前是否正在进行游戏（true为正在进行游戏false为正在准备）
            ing:true,
        }
    },
    // 进入房间
    enter : function(roomId, uid, gold){
        if (! this.data[roomId]) {
            this.data[roomId] = {
                chr:[null,null,null,null,null],
                // 池子总金币
                tg:0,
                // 当前单注
                sg:1000,
                // 当前是否正在进行游戏（true为正在进行游戏false为正在准备）
                ing:false,
            };
        }
        // 找座
        var chairs = this.data[roomId].chr;
        var index = 0;
        for (var i = 0;i < 5; i++){
            if (chairs[i] == null) {
                index = i;
                break;
            }
        }
        chairs[index] = {
            uid:uid,
            g:gold,
        };
        return index;
    },
    // 退出房间
    exit:function(roomId, chair) {
        this.data[roomId].chr[chair] = null;
    },
    // 准备
    prepare:function(roomId,chair) {
        console.log("prepare", roomId, chair, this.data[roomId]);
        this.data[roomId].chr[chair].pre = true;
    },
    // 检测一个房间是不是可以开始了
    checkCanStart:function(roomId) {
        // 玩家数量
        var playerCount = 0;
        // 已准备的玩家数量
        var preparedCount = 0;
        var chairs = this.data[roomId].chr;
        for(var i = 0; i < 5; i ++) {
            if (chairs[i] != null) {
                playerCount ++;
                if (chairs[i].pre == true) {
                    preparedCount ++;
                }
            }
        }
        if (preparedCount == playerCount && playerCount >= 2) {
            return true;
        } else {
            return false;
        }
    },
    // 得到正在玩的玩家数量
    getPlayingCount:function (roomId) {
        // 已准备的玩家数量
        var preparedCount = 0;
        var chairs = this.data[roomId].chr;
        for(var i = 0; i < 5; i ++) {
            if (chairs[i] != null) {
                if (chairs[i].pre == true) {
                    preparedCount ++;
                }
            }
        }
        return preparedCount;
    },
    // 发牌
    dispatchCard:function (roomId, cards) {
        var chairs = this.data[roomId].chr;
        // 已准备的玩家数量
        var preparedCount = 0;
        // 发言人
        var speaker = -1;
        for(var i = 0; i < 5; i ++) {
            if (chairs[i] != null) {
                if (chairs[i].pre == true) {
                    if (speaker == -1) {
                        speaker = i;
                    }
                    preparedCount ++;
                    chairs[i].card = cards[preparedCount-1];
                }
            }
        }
        // 设置为正在进行游戏
        this.data[roomId].ing = true;
        // 设置发言人
        this.data[roomId].s = speaker;
    },

};
