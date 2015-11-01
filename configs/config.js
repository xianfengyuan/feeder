module.exports = {
  interval: 300,
  domain: {
    dev: "sheermountain.com"
  },
  gdir: function(key) {
    var cdir = process.env.CACHEDIR;
    if (cdir === undefined) {
      cdir = '/var/lib';
    }
    return cdir + '/' + key + '.json';
  }
};
