var request = require('request'),
    _       = require('underscore'),
    cheerio = require('cheerio'),
    redis   = require('redis'),
    db      = redis.createClient();

db.on("error", function(err) {
    console.log("REDIS: " + err);
});

var expire_time = process.env.NODE_ENV == 'production' ? 1800 : 1200;

var save_to_db = function(key, value) {
    db.set(key, value);
    db.expire(key, expire_time);
}

var poll_craigslist = function(callback) {
    console.log("polling craigslist");

    var body_extractor = function(idx, elem) {
        var $this     = $(this),
            post_id   = $this.attr('data-pid'),
            latitude  = $this.attr('data-latitude'),
            longitude = $this.attr('data-longitude'),
            anchor    = $this.children('a').attr('href'),
            title     = escape($this.children('.pl').children('a').text());

        if (latitude === undefined && longitude === undefined) {
            // Need to figure out what to do later if we dont have the longitude and latitude
            // var location = $this.children('.l2').children('.pnr').children('small').text();
            return {};
        }

        return {
            'post_id': post_id,
            'longitude': longitude,
            'latitude': latitude,
            'anchor': anchor,
            'title': title
        };
    };

    var not_empty = function(elem, idx) {
        return !_.isEmpty(elem);
    };

    request('http://sfbay.craigslist.org/sfc/zip/', function(error, response, body) {
        if (error || response.statusCode != 200) {
            callback({});
        }

        $ = cheerio.load(body);

        var data = JSON.stringify($('p.row').map(body_extractor).filter(not_empty));
        save_to_db('free', data);

        callback(data);
    });
};

var poll_item = function(craigslist_endpoint, callback) {
    console.log("looking at " + craigslist_endpoint);

    var craigslistLink = 'http://sfbay.craigslist.org' + craigslist_endpoint;

    request(craigslistLink, function(err, response, body) {
        if (err || response.statusCode != 200) {
            callback("");
        }

        $ = cheerio.load(body);
        var body = $('#postingbody').text(),
            title = $('h2.postingtitle').text();

        var data = JSON.stringify({
            'body': body,
            'title': title,
            'link': craigslistLink
        });

        save_to_db(craigslist_endpoint, data);

        callback(data);
    });
};

exports.listings = poll_craigslist;
exports.item = poll_item;