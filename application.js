var _ = require("lodash");
var ContainershipPlugin = require("containership.plugin");
var cli = require([__dirname, "lib", "cli"].join("/"));
var leader = require([__dirname, "lib", "leader"].join("/"));
var follower = require([__dirname, "lib", "follower"].join("/"));
var nomnom = require("nomnom");
var url = require("url");

module.exports = new ContainershipPlugin({
    type: ["core", "cli"],
    name: "cloud",

    initialize: function(core){
        if(_.has(core, "logger")){
            core.logger.register("containership-cloud");

            var config = this.get_config("core");

            if(core.options.mode == "leader")
                leader.initialize(core, config);
            else
                follower.initialize(core, config);
        }
        else{
            _.each(cli, function(configuration, command){
                nomnom.command(command).options(configuration.options).callback(configuration.init)
            });

            return {
                nomnom: nomnom,
                middleware: [
                    function(options, fn){
                        if(options.url.indexOf("https://api.containership.io") == 0){
                            var original_url = options.url;
                            options.url = [
                                "https://api.containership.io",
                                "v1",
                                options.headers["x-containership-cloud-organization"],
                                "clusters",
                                options.headers["x-containership-cloud-cluster"],
                                "proxy"
                            ].join("/");

                            var original_method = options.method;
                            options.method = "POST";

                            options.headers = _.pick(options.headers, [
                                "x-containership-cloud-email",
                                "x-containership-cloud-token",
                            ]);

                            var original_qs = options.qs;
                            options.qs = {};

                            var original_body = options.json;

                            var proxy_url = url.parse(original_url).path.split("/");
                            proxy_url.splice(1, 1);

                            options.json = {
                                url: proxy_url.join("/"),
                                qs: original_qs,
                                method: original_method,
                            }

                            if((original_method == "POST" || original_method == "PUT") && !_.isUndefined(original_body))
                                options.json.data = original_body;
                        }

                        return fn();
                    }
                ]
            }
        }
    },

    reload: function(){}
});
