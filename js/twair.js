/*
 * - Twair -
 *
 */
var TWITTER_LAST = 0;
var LOG_LIMIT    = 100;

var TYPE = {"TWITTER":0};
var CONFIG = null;
var FRIENDS_TIMELINE_API = 'http://twitter.com/statuses/friends_timeline.json';
var TWITTER_POST_API     = 'http://twitter.com/statuses/update.json';
var TWITTER_REPLIES_API  = "http://twitter.com/statuses/replies.json";
var TWITTER_FAVORITE_API = "http://twitter.com/favourings/create/";

var CACHE = [];

function initialize() {
	try {
		$("#btn_showTweets").click(function() {
			$("#contents").show();
			$("#replies").hide();
		});
		$("#btn_showReplies").click(function() {
			$("#contents").hide();
			$("#replies").show();
		});
		$("#btn_reload").click(reload);
		$("#btn_openInput").click(function(){openInput(0)});
		$("#ck_inFront").click(function(){
			window.nativeWindow.alwaysInFront = this.checked;
		});
		$("#btn_postMessage").click(postMessage);
		window.nativeWindow.addEventListener("resize" , function(event) {
				try {
				$("#main").height(event.afterBounds.height - 60);
			} catch(e) {
				alert(e);
			}
		}); 
		show_login_form();
	} catch(e) {
		alert(e.message);
	}
}
function show_login_form() {
	var config = loadConfig();
	$("#username").val(config.username);
	$("#password").val(config.password);
	$('#loginform').modal();
}
function login() {
	$.ajax({
		type:     "POST",
		url:      "http://twitter.com/account/verify_credentials.json",
		dataType: "text",
		username: $("#username").val() ,
		password: $("#password").val() ,
		complete: function(request , status) {
			if(status == "error") {
				alert("wrong id  or password");
			}
			else {
				logined_process(this.username , this.password);
			}
		}
	});
}
function logined_process(username , password) {
	try {
		var file = air.File.applicationStorageDirectory.resolvePath("config.txt");
		CONFIG = {"username":username , "password":password};
		var stream = new air.FileStream();
		stream.open(file,air.FileMode.WRITE);
		stream.writeObject(CONFIG);
		stream.close();
	} catch(e) {
		alert("error at congifure : " + e.message);
	}
	$.modal.close();
	reload();
	setInterval(function(){reload()} , 60 * 1000);
	setInterval(function(){reload_replies()} , 5 * 60 * 1000);
}
function loadConfig() {
	var file = air.File.applicationStorageDirectory.resolvePath("config.txt");
	if(file.exists) {
		try {
			var stream = new air.FileStream();
			stream.open(file,air.FileMode.READ);
			return stream.readObject();
		} catch(e) {
		} finally {
			stream.close();
		}
	}
	return {};
}
function initialize_system_tray() {
	// アイコンファイルをアサインする  
	var loader = new air.Loader();  
	loader.load(new air.URLRequest('app:/icons/AIRApp_16.png'));  
	loader.contentLoaderInfo.addEventListener(air.Event.COMPLETE, 
			function (event) {  
				var bitmap = air.Bitmap(event.target.loader.content);  
				air.NativeApplication.nativeApplication.icon.bitmaps 
													= [bitmap.bitmapData];
			});  
}
function reload(flg) {
	reload_twitter(flg);
	reload_replies();
}
function reload_twitter(flg) {
	if(flg != undefined && !flg) {
		return;
	}
	notifyMessage("reload ..." , -1);
	$.ajax({
		type:     "POST",
		url:      FRIENDS_TIMELINE_API,
		dataType: "text",
		complete: function(request , status) {
			load(request.responseText , TYPE.TWITTER);
		}
	});
}
function load(text , type) {
	try {
		notifyMessage("loading ...");
		var json = eval(text);
		var latest = [];
		for(var i = 0 ; i < json.length ; i ++) {
			if(TWITTER_LAST != json[i].id){ latest.push(new Tweet(json[i])); }
			else { break; }
		}

		CACHE = latest.concat(CACHE);
		while(CACHE.length > LOG_LIMIT) {
			CACHE.pop();
		}

		var info = new Table(CACHE , {"id":"tweets" , "expand":true}).toHtml();
		TWITTER_LAST = json[0].id;

		if(info.notifiers.length > 0) {
			notifyReplies(info.notifiers.join(","));
		}
		if(info.html == "" || info.html == null) {
			return;
		}
		document.title = "Twair - new " + info.count + " messages"
		$("#contents").html(info.html);
		attach_event();
		$("#contents").attr("scrollTop" , 0);
	} catch(e) {
		notifyMessage("loading error : " + e.message);
	}
}
function attach_event() {
	var list = document.getElementsByTagName("a");
	for(var i = 0 ; i < list.length ; i++) {
		if(list[i].name == "user_name") {
			list[i].onclick = function(name){
				return function(){openInput(1,"@"+ name + " ");}
			}(list[i].innerText);
		}
		else if(list[i].name == "link") {
			list[i].onclick = function(url){
				return function(){openURL(url);}
			}(list[i].innerText);
		}
	}
	list = document.getElementsByTagName("img");
	for(var i = 0 ; i < list.length ; i++) {
		if(list[i].name == "img_link") {
			list[i].onclick = function(url){
				return function(){openURL(url);}
			}("http://twitter.com/" + list[i].getAttribute("screen_name"));
			list[i].oncontextmenu = function(url){
				event.preventDefault(); 
				var menu = new air.NativeMenu(); 
				var command = menu.addItem(new air.NativeMenuItem("fav")); 
				command.addEventListener(air.Event.SELECT, function(){
					var tweetId = event.srcElement.getAttribute("tweetId");
					$.ajax({
						type:     "POST",
						url:      TWITTER_FAVORITE_API + tweetId + ".json",
						dataType: "json",
						data:     "id=" + tweetId,
						id:       tweetId,
						success: function(data, dataType) {
							for(var k = 0 ; k < CACHE.length ; k ++) {
								if(CACHE[k].id == this.id) {
									CACHE[k].favorited = true;
									$("#" + this.id + "_img_favorite").css("display","");
									break;
								}
							}
						},
						error: function(request , status , errorThrown) {
							alert("failed");
						}
					});
				}); 
				menu.display(window.nativeWindow.stage, event.clientX, event.clientY); 
			}
		}
	}
}

function openInput(mode , msg) {
	var area = $("#input_area");
	if(mode == 0 && area.css("display") != "none") {
		area.hide();
		return;
	}
	$("#input_text").val(msg == undefined ? "" : msg);
	area.show();
	area.css("top" , 24);
	$("#input_text").focus();
}
function postMessage() {
	notifyMessage("post message ...");

	var text = $("#input_text").val();
	if(text != "") {
		_postMessage(TWITTER_POST_API , text , true);
	}

	$("#input_text").val("");
	$("#input_area").hide();

	function _postMessage(url , text , isReload) {
		$.ajax({
			type:     "POST",
			url:      url,
			data:     "status=" + text,
			dataType: "text",
			isReload: isReload,
			complete: function(request , status) {
				reload(this.isReload);
			}
		});
	}
}
function notifyMessage(message , interval) {
	$("#message").show();
	$("#message").text(message);
	if(interval == undefined) {
		interval = 2000;
	}
	else if(interval == -1) {
		return;
	}
	setTimeout((function(){return function(){
		$("#message").hide()}
	})() , interval);
}
function notifyReplies(msg) {
    var options = new air.NativeWindowInitOptions(); 
    options.transparent = false; 
    options.systemChrome = air.NativeWindowSystemChrome.STANDARD; 
    options.type = air.NativeWindowType.NORMAL; 
    //create the window 
    var newWindow = new air.NativeWindow(options); 
    newWindow.title = "reply";
    newWindow.width = 300
    newWindow.height =150; 
    newWindow.x = 0;
    newWindow.y = 0;

   	var button = new air.TextField();
    button.text = "reply from " + msg;
    button.width = 100;
    button.height = 30;
  	button.autoSize = air.TextFieldAutoSize.LEFT;
    button.border = true;
    button.backgroundColor = "0xFF0000";
    newWindow.stage.addChild(button);


    //activate and show the new window 
    newWindow.activate();
    newWindow.alwaysInFront = true;

    return;


	var title   = "notifyReplies";
	var text    = msg;
	var timeout = 5;
	/*
	var img     = undefined;
	var n = new runtime.com.adobe.air.notification.Notification(title, text, null, timeout,img);
	n.addEventListener(	runtime.com.adobe.air.notification.NotificationEvent.NOTIFICATION_CLICKED_EVENT, function(evt){ winmgr.restore(); });
		
    n.width = 250;
//	purr.addNotification(n);

	return;
	*/

	var option = new air.NativeWindowInitOptions();
   	option.systemChrome = air.NativeWindowSystemChrome.NONE;
	option.type = "lightweight";

	var screen_widh   = window.nativeWindow.stage.fullScreenWidth;
	var screen_height = window.nativeWindow.stage.fullScreenHeight;
	var width  = 200;
	var height = 20;

	/*
	var win = new air.NativeWindow(option);
	win.width  = 200;
    win.height = 100;
	win.x = screen_widh   - win.width;
	win.y = screen_height - win.height - 30;
	var loader = new air.HTMLLoader(); 
	win.stage.align = "TL"; 
	win.stage.scaleMode = "noScale"; 
	win.stage.addChild(loader);
	win.alwaysInFront = true;

	win.activate();
	loader.loadString(buf);
	*/
	


	//var buf = "<div background='image/bg.gif' style='border:2px solid #0080FF'>" + msg + "</div>"

	var buf = "<html>"
			  + "<body background='image/bg.gif' style='border:2px solid #0080FF'>"
			  + "<table style='width:100%;height:100%'><tr><td valign=middle align=center>"
			  + "<span id='msg' style='font-size:10pt;'>reply from " + msg + "</span>"
			  + "</td></tr></table>"
			  + "</body>"
			  + "</html>"

	var windowBounds = new air.Rectangle(screen_widh - width , screen_height - height - 50 , width , height); 
	var loader = air.HTMLLoader.createRootWindow(true, option, true, windowBounds); 
	var win = loader.window;
	win.alwaysInFront = true;
	loader.loadString(buf);

	setTimeout(function(win){return function(){win.close();}}(win) , 5000);
}
function reload_replies() {
	$.ajax({
		type:     "POST",
		url:      TWITTER_REPLIES_API,
		data:     "page=1",
		dataType: "text",
		complete: function(request , status) {
			var json = eval(request.responseText);
			var list = [];
			for(var i = 0 ; i < json.length ; i ++) {
				list.push(new Tweet(json[i]));
			}
			var info = new Table(list , {"id":"table_replies" , "expand":false}).toHtml();
			$("#replies").html(info.html);
			attach_event();
		}
	});
}
function openURL(url) {
	air.navigateToURL(new air.URLRequest(url),"_blank");
}
function Tweet(json) {
	this.type        = TYPE.TWITTER;
	this.id          = json.id;
	this.text        = json.text;
	this.screen_name = json.user.screen_name;
	this.image_url   = json.user.profile_image_url;
	this.favorited   = json.favorited;
}
function Table(list , option) {
	this.list   = list;
	this.option = ((option == undefined || option == null) ? {} : option);
	this.toHtml = _toHtml;
	function _toHtml() {
		var buf = "";
		var count = 0;
		var flg   = true;
		var notify_user_name = [];
		for(var i = 0 ; i < this.list.length ; i ++) {
			var tweet = this.list[i];
			var news = false;
			if(TWITTER_LAST < tweet.id) {
				count ++;
				news = true;
			}
			else {
				if(flg) {
					flg = false;
				}
			}

			var text = tweet.text;

			text=text.replace(/>/g,'&gt;');
			text=text.replace(/</g,'&lt;');
			text=text.replace(/(http:\/\/[a-zA-Z0-9\.\/\?_\-&]*)/ , 
					function(str, p1) {
						return "<a name='link' class='outer_link' href='javascript:void(0);'>" + p1 + "</a>";
					});
			if(text == "") {
				count --;
				continue;
			}

			buf += "<table id='" + this.option.id + "' ";
			if(text.indexOf("@" + CONFIG.username) != -1) {
				if(news) {
					notify_user_name.push(tweet.screen_name);
				}
				if(this.option.expand == undefined ? true : this.option.expand) {
					buf += " style='border:2px solid orange;'";
				}
			}
			buf += "><tr>"
				+ "<td valign='top'>"
				+ "<img name='img_link' " 
				        + " id='" + tweet.id + "_img'"
						+ " src='" + tweet.image_url + "' width='30' height='30'" 
						+ " tweetId='" + tweet.id + "' style='cursor:pointer;'"
						+ " screen_name='" + tweet.screen_name + "' style='cursor:pointer;'"
						+ ">"
				+ "</img>"
				+ "<br>"
				+ "<img id='" + tweet.id  + "_img_favorite' src='image/favorite.gif' " 
				+ (tweet.favorited ? "" : "style='display:none'>")
				+ "</td>" 
				+ "<td valign='top' >"
				+ "<span>"
				+ "<a class='" + (news ? "user_link_expand" : "user_link") + "' name='user_name' href='javascript:void(0)' style='font-size:10pt;" 
				+ (news ? "background-color:orange" : "")  
				+ "'>" 
				+ tweet.screen_name 
				+ "</a>"
				+ "</span>"
				+ "&nbsp;"
				+ "<span style='font-size:10.5pt;line-height:140%;word-break:break-all;'>"
				+ text 
				+ "</span>"
				+ "</td>"
				+ "</tr>"
				+"</table>";

		}
		return {html:buf , notifiers:notify_user_name , count:count};
	}
}
