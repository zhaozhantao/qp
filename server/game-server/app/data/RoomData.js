module.exports = {
    data : {},
    enter : function(roomId, uid){
        if (! this.data[roomId]) {
            this.data[roomId] = {chairs:[]};
        }
        var chairs = this.data[roomId].chairs;
        chairs[chairs.length] = uid;
    },

};
