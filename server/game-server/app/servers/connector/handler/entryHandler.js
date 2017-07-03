var RoomData = require("../../../data/RoomData");
module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    this.channelService = app.get("channelService");
};

Handler.prototype.entry = function(msg, session, next) {
    next(null, {code: 200, msg: 'game server is ok.'});
};

// 登录
Handler.prototype.login = function(msg, session, next) {
    var username = msg.username;
    session.bind(username, function(){
        next(null, {ret: 0});
    });
};
// 进入房间
Handler.prototype.enterRoom = function(msg, session, next) {
    var uid = session.uid;
    var sid = this.app.get('serverId');
    var roomId = "1";
    console.log("uid为", uid);
    var chair = RoomData.enter(roomId, uid);
    session.set("roomId", roomId);
    session.set("chair", chair);
    session.pushAll();
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    channel.pushMessage("onEnterRoom", {uid:uid,chair:chair,gold:1000});
    channel.add(uid, sid);
    next(null, {ret:0, data:{roomId:roomId,chair:chair,roomData:RoomData.data[roomId]}});

    // 断开时的处理
    session.on("closed", function() {
        channel.leave(uid, sid);
        RoomData.exit(roomId, chair);
        channel.pushMessage("onExitRoom", {chair:chair});
    });
};

// 准备
Handler.prototype.prepare = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.prepare(roomId, chair);
    channel.pushMessage("onPrepare", {chair:chair});
    if (RoomData.checkCanStart(roomId)) {
        RoomData.dispatchCard(roomId, [[[1],[1]],[[1],[1]],[[1],[1]]]);
        channel.pushMessage("onDispatch", {chair:chair});

    }
    next(null, {ret:0});
};
// 看牌
Handler.prototype.look = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.look(roomId, chair);
    channel.pushMessage("onLook", {});
    next(null, {ret:0, data:RoomData.data[roomid].chr[chair].card});
};
// 跟注
Handler.prototype.follow = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.follow(roomId);
    channel.pushMessage("onFollow", {speaker:RoomData.data[roomid].s});
    next(null, {ret:0});
};
// 加注
Handler.prototype.addGold = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var gold = msg.gold;
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.addGold(roomId, gold);
    channel.pushMessage("onAddGold", {speaker:RoomData.data[roomid].s, gold:gold});
    next(null, {ret:0});
};
// 放弃
Handler.prototype.giveup = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var gold = msg.gold;
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    RoomData.giveup(roomId);
    channel.pushMessage("onGiveup", {speaker:RoomData.data[roomid].s});
    next(null, {ret:0});
};
// 比牌
Handler.prototype.compare = function(msg, session, next) {
    var uid = session.uid;
    var roomId = session.get("roomId");
    var chair = session.get("chair");
    var toChair = msg.toChair;
    var channel = this.channelService.getChannel("roomChannel_"+ roomId, true);
    var ret = RoomData.compare(roomId, toChair);
    channel.pushMessage("onCompare", {speaker:RoomData.data[roomid].s, win:ret});
    next(null, {ret:0});
    if (RoomData.checkCanOver(roomId)) {
        RoomData.over(roomId);
        channel.pushMessage("onOver", {});
    }
};