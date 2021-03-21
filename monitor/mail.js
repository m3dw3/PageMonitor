var moment		= require('moment');
var db			= require(__dirname + '/db');
var appConfig	= require(__dirname + '/../config');

var getMailer = function ( config ) {
	var mailFunctions = {
		'mandrill': {
				sendMail : function ( message, tag ) {
					var mandrill	= require('mandrill-api/mandrill');
					var mandrillClient	= new mandrill.Mandrill( appConfig.mandrill.apiKey );
					message.subject = (appConfig.mandrill.subjectPrefix ? appConfig.mandrill.subjectPrefix + ' ' : '') + (tag ? (' - ' + tag) : '') + ' - ' + config.name;
					message.from_email = appConfig.mandrill.fromEmail;
					message.from_name = appConfig.mandrill.fromName;
					message.tags = ['page-monitor'];
					return new Promise( function ( resolve, reject ) {
						mandrillClient.messages.send( { message: message }, function( result ) {
							resolve( result );
						}, function( err ) {
							reject( err );
						});
					});
				}
		},
		'mailgun': {
				sendMail : function ( message, tag ) {
					var mailgun		= require('mailgun-js')( {apiKey: appConfig.mailgun.apiKey, domain: appConfig.mailgun.domain} );
					message.from = appConfig.mailgun.fromName + ' <' + appConfig.mailgun.fromEmail + '>';
					message.subject = (appConfig.mailgun.subjectPrefix ? appConfig.mailgun.subjectPrefix + ' ' : '') + (tag ? (' - ' + tag) : '') + ' - ' + config.name;
					message['o:tag'] = 'page-monitor';
					toList = message.to;
					message.to = '';
					toList.forEach( function( element, index ){
						if( index )
							message.to += ',';
						message.to += element.email;
					});
					return new Promise( function ( resolve, reject ) {
						mailgun.messages().send(message, function ( err, result ) {
							if( err )
								reject( err );
							else
								resolve( result );
						});
					});
				}
		}
	};
	return mailFunctions[appConfig.mailService];
};


var createHtmlListFromItems = function ( items, referenceItems = [] ) {

	var html = '';

	html += '<ul style="list-style-type:none;">' + "\n";

	for ( var i in items ) {

		var item = items[ i ];
		if (referenceItems.length) {
			var referenceItem = referenceItems[ i ]
		}

		html += '<li>' + "\n";

			html += '<a href="' + item.link + '"><h3>' + item.name + '</h3></a>' + "\n";

			if ( item.image )
				html += '<img src="' + item.image + '" style="-webkit-filter: drop-shadow(0px 0px 2px #444); filter: drop-shadow(0px 0px 2px #444); border-radius: 1%;">' + "\n";

			html += '<p><ul>' + "\n";
			html += '<li>#' + item.id + '</li>' + "\n";

			for ( var j in item ) {

				if ( j === 'name' || j === 'id' || j === 'link' || j === 'image' || !item[ j ] )
					continue;

				if (!referenceItem || item[ j ] === referenceItem[ j ] ) {
					html += '<li>' + j + ': <b>' + item[ j ] + '</b></li>' + "\n";
				} else {
					html += '<li>' + j + ': <s>' + referenceItem[ j ] + '</s> <b>' + item[ j ] + ' ⭐️</b></li>' + "\n";
				}
			}

			html += '</ul></p>' + "\n";

		html += '</li>' + "\n";
	}

	html += '</ul>' + "\n";

	return html;
};



module.exports = {
	sendMail: function ( config, url, email, tag, newItems, updatedItems, referenceItems, customHTML ) {

		if ( !email || ( !newItems.length && !updatedItems.length && !customHTML ) )
			return;

		try {

			var html			= '';

			if ( newItems.length ) {

				html += '<h1>🆕 NEW</h1>' + "\n";
				html += createHtmlListFromItems( newItems );
			}

			if ( newItems.length && updatedItems.length ) {

				html += '<br>' + "\n";
				html += '<br>' + "\n";
			}

			if ( updatedItems.length ) {

				html += '<h1>⭐️ UPDATED</h1>' + "\n";
				html += createHtmlListFromItems( updatedItems, referenceItems );
			}

			if ( customHTML )
				html += customHTML;

			html += '<br>' + "\n";
			html += '<br>' + "\n";
			html += 'URL: <b><a href="' + url + '">' + url + '</a></b>' + "\n";

			var to = [];
			var emails = email.split(/[,;]/);

			for ( var i in emails )
				to.push({ email: emails[ i ].trim()});

			var message = {
				html:		html,
				to:			to
			};

			var mailer = getMailer( config );
			mailer.sendMail(message, tag).then( function(result) {
				console.log( '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] Mail success: ' + config.name + (tag ? (' - ' + tag) : '') + ' - ' + email );

			}).catch( function( err ) {
				console.error( '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] Mail error: ' + err.name + ' - ' + err.message );
				db.rollback( config, email, newItems, updatedItems );
			});

		} catch ( err ) {

			console.error( '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] ' + err.stack );
			db.rollback( config, email, newItems, updatedItems );
		}
	}
};
