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
                    // 是否已失败
                    lose:false,
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
    // 设置下一位为发言人
    nextSpeaker:function(roomId) {
        for (var i = 1; i < 5; i++) {
            var idx = (this.data[roomId].s + i) % 5;
            var chair = this.data[roomId].chr[idx];
            if (chair != null && chair.pre == true && chair.gu != true) {
                this.data[roomId].s = idx;
                break;
            }
        }
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
    // 看牌
    look:function(roomId, chairIdx) {
        var room = this.data[roomId];
        room[chairIdx].look = true;
    },
    // 跟注
    follow:function(roomId) {
        var room = this.data[roomId];
        var speaker = room.s;
        room[speaker].cg += room.sg;
        room[speaker].tg -= room.sg;
        room.tg += room.sg;
        this.nextSpeaker(roomId);
    },
    // 加注,gold为加到的钱，而不是增加的钱
    addGold:function(roomId, gold) {
        var room = this.data[roomId];
        var speaker = room.s;
        room.sg = gold;
        room[speaker].cg += room.sg;
        room[speaker].tg -= room.sg;
        room.tg += room.sg;
        this.nextSpeaker(roomId);
    },
    // 弃牌
    giveup:function(roomId) {
        var room = this.data[roomId];
        var speaker = room.s;
        room[speaker].gu = true;
        this.nextSpeaker(roomId);
    },
    // 比牌 toChair 和谁比
    compare:function(roomId, toChair) {
        var room = this.data[roomId];
        var speaker = room.s;
        var ret = compareCard.do(room.chr[speaker].card, room.chr[toChair].card);
        if (ret == true) {
            room.chr[toChair].lose = true;
        } else {
            room.chr[speaker].lose = true;
        }
        return ret;
    },
    // 检测是否可以结束这一局了
    checkCanOver: function(roomId) {
        var room = this.data[roomId];
        var count = 0;
        for (var i = 0; i < room.chr.length; i++) {
            var chair = room.chr[i];
            if (chair != null && chair.pre = true && chair.gu != true && chair.lose != true) {
                count ++;
            }
        }
        return count == 1;
    },
    // 结算一局
    over:function(roomId) {
        var room = this.data[roomId];

        // for (var i = 0; i < room.chr.length; i++) {
        //     var chair = room.chr[i];
        //     if (chair != null && chair.pre = true && chair.gu != true && chair.lose != true) {
        //         // 获胜者
        //         chair
        //     }
        // }
        room.ing = false;
    },
};
