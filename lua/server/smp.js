'use strict';

const marked = require('marked');
const katex = require('katex');
const path = require('path');
const Hapi = require('@hapi/hapi');
const fs = require('fs');
const BookUtils = require('./bookutils');
const plantumlEncoder = require('plantuml-encoder');

const defaultMarkDownCss = '/styles/github-markdown.css';
const smpConfig = {
	css: defaultMarkDownCss,
};

const getStylesheet = function () {
	const stylesheet = `
  <link rel="stylesheet" href="${smpConfig.css}" type="text/css">
	<link rel="stylesheet" href="/styles/highlight-github.css" type="text/css">
	<link rel="stylesheet" href="/styles/smp.css" type="text/css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.15.1/dist/katex.min.css">

	
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }

    @media (max-width: 767px) {
      .markdown-body {
        padding: 15px;
      }
    }
    .ball {
      width: 0;
      height: 0;
      border-right: 1rem solid red;
      margin-left: 0.5rem;
    }

  </style>
`;

	return stylesheet;
};

const getSmoothScrollScript = function (bufnr, lnr, thisline) {
	thisline = thisline.replace(/`/g, '\\`');
	return `
<script type="text/javascript">
let thisTs = 0;
let lastTs = -1;
function removeExistingBalls(){
    const ballElements = document.querySelectorAll(".ball");

    ballElements.forEach((element) => {
      element.classList.remove("ball");
    });
}

function setIndicator(linenr, lineText){
console.log('setIndicator', linenr, lineText);
  let thisAnchor=null;
  let foundLineNr = linenr;
  for(let i=linenr; i>=1; i--){
      thisAnchor = document.querySelector(\`.lucas_tkbp_\${linenr}\`);
      if(thisAnchor !==null){
        foundLineNr = i;
        break;
      }
  }
  if(thisAnchor !== null){
      removeExistingBalls();
      thisAnchor.classList.add("ball");
  }
  if(foundLineNr !== linenr && lineText.trim()  !==   ""){
    try{window.find(lineText)}catch(err){}
  }
}

function scrollOnly(linenr, lineText){
console.log('scrollOnly', linenr, lineText);
  linenr = linenr - 3;
  if (linenr < 1) linenr = 0;
  let thisAnchor=null;
  let foundLineNr = linenr;
  for(let i=linenr; i>=0; i--){
console.log("\tfinding ", i);
      thisAnchor = document.querySelector(\`.scrollTo.lucas_tkbp_\${i}\`);
      if(thisAnchor !==null){
        foundLineNr = i;
        break;
      }
  }
  if(thisAnchor !== null){
console.log("Found line", foundLineNr, "scrollIntoView", foundLineNr)
      try{thisAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });}catch(err){}
  }else{
console.log("not scroll for", linenr)
  }
}

function scrollToLine(linenr, lineText){
console.log('scrollToLine', linenr, lineText);
  setIndicator(linenr, lineText);
  scrollOnly(linenr, lineText);
}

scrollToLine(${lnr}, \`${thisline}\`);



let fetchFailed = 0;
let intervalId=0;
function fetchData() {
    let url = "http://127.0.0.1:3030/getupdate/${bufnr}/" + thisTs;
    lastTs = thisTs;
    fetch(url)
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        switch(data.code){
          case 'touched_all':
            document.querySelector(".markdown-body").innerHTML = data.html;
            scrollToLine(data.linenr, data.thisline);
            break;
          case 'touched_line':
            scrollToLine(data.linenr, data.thisline);
            break;
          default:
        }
        if(data.ts) {thisTs = data.ts; }
      })
      .catch((error) => {
        // console.error("There was a problem with the fetch operation:", error);
        fetchFailed += 1;
        if(fetchFailed > 200){
          try{clearInterval(intervalId);}catch(err){}
        }
      });
}
intervalId = setInterval(fetchData, 300);
</script>
  `;
};

const inputString = 'The file is [[example.txt]], and this is [[example2]]';
const regex_wiki = /\[\[(.*?)\]\]/g;
const regex_snippet = /^\s*{(.+)}\s*$/;
const regex_link = /\[(.*)]\s*\((.+)\)/;

let string_stores = {};
let fn_stores = {};
let buf_session = {};
let serNumber = 0;

const logFile = 'smp_server_log.txt';

function logToFile(message) {
	const timestamp = new Date().toISOString();
	const logMessage = `${timestamp} - ${message}\n`;

	fs.appendFile(logFile, logMessage, (err) => {
		if (err) {
			console.error('Error writing log message:', err);
			// } else {
			// 	console.log('Log message written:', message);
		}
	});
}

// Usage:
const renderer = new marked.Renderer();

// Override the 'codespan' function to handle inline math
renderer.codespan = function (text) {
	if (text.startsWith('\\(') && text.endsWith('\\)')) {
		const latex = text.slice(2, -2);
		return katex.renderToString(latex, { throwOnError: false });
	}
	return `<code>${text}</code>`;
};

const hljs = require('highlight.js');
let hl = function (code, lang) {
	const language = hljs.getLanguage(lang) ? lang : 'plaintext';
	return hljs.highlight(code, { language }).value;
};

const imagelizedLang = ['plantuml', 'math'];

// Override the 'code' function to handle block-level math
// renderer.code = function (code, infostring) {
// 	if (infostring === 'math') {
// 		return katex.renderToString(code, { displayMode: true, throwOnError: false });
// 	}
// 	return `<pre><code class="hljs language-${infostring}">${hl(code, infostring)}</code></pre>`;
// };
renderer.code = function (code, infostring, lineNumber) {
	// return `<pre><code class="language-${infostring}">${code}</code></pre>`;
	if (infostring === 'math') {
		return katex.renderToString(code, { displayMode: true, throwOnError: false });
	} else if (infostring === 'plantuml') {
		const imageUrl = generatePlantUmlImageUrl(code);
		return `<img src="${imageUrl}"/>`;
	}
	return `<pre><code class="hljs language-${infostring}">${hl(code, infostring)}</code></pre>`;
};

class CustomLexer extends marked.Lexer {
	constructor(options) {
		super(options);
	}

	lex(src) {
		const tokens = [];
		let lineNumber = 1;

		while (src) {
			const nextToken = super.token(src, true);
			if (nextToken) {
				src = src.slice(nextToken.raw.length);

				if (nextToken.type === 'code') {
					nextToken.lineNumber = lineNumber;
				}
				lineNumber += (nextToken.raw.match(/\n/g) || []).length;

				tokens.push(nextToken);
			} else {
				src = '';
			}
		}

		return tokens;
	}
}

marked.setOptions({
	renderer: renderer,
	Lexer: CustomLexer,
	highlight: function (code, lang) {
		const hljs = require('highlight.js');
		const language = hljs.getLanguage(lang) ? lang : 'plaintext';
		return hljs.highlight(code, { language }).value;
	},
	langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
	pedantic: false,
	gfm: true,
	breaks: false,
	sanitize: false,
	smartypants: false,
	xhtml: false,
});

function getKeyByValue(obj, value) {
	for (const key in obj) {
		if (obj[key] === value) {
			return key;
		}
	}
}

function isValidUrl(string) {
	let url;

	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}

	return url.protocol === 'http:' || url.protocol === 'https:';
}

function generatePlantUmlImageUrl(plantUmlSource) {
	const encodedPlantUml = plantumlEncoder.encode(plantUmlSource);
	const plantUmlServerUrl = 'http://www.plantuml.com/plantuml/img/';
	return plantUmlServerUrl + encodedPlantUml;
}
const indicator = function (lnr, scroll = true) {
	return `<span class="${scroll ? 'scrollto' : ''} lucas_tkbp_${lnr + 1}"></span>`;
};

const patchLine = (line, lnr, dir_of_current_md, patchLineNr = true) => {
	//Reference , don't touch
	logToFile('patch: ' + line);
	if (line.match(/^\s*\[.+]:\s*.+$/)) {
		//Refen
		patchLineNr = false;
	} else if (line.match(/^\s*$/)) {
		//Patch bank line
		//Blank like, don't touch
		patchLineNr = patchLineNr;
	} else if (line.match(regex_snippet)) {
		logToFile(`Found snippet: ${line}`);
		let m = line.match(regex_snippet);
		let snippetName = m[1].trim();
		function parse_snippet_content(snippet, level = 0) {
			//stop parse if level > 9
			if (level > 9) return null;
			if (!(smpConfig && smpConfig.snippets_folder)) {
				logToFile('smpConfig.snippets_folder is not defined');
				return null;
			}
			let fullPath = path.resolve(smpConfig.snippets_folder, snippet + '.md');
			if (fs.existsSync(fullPath)) {
				logToFile('found ' + fullPath);
				let content = fs.readFileSync(fullPath, 'utf8');
				let lines = content.split('\n');
				let foundChildSnippet = false;
				let retContentLines = [];
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].match(regex_snippet)) {
						foundChildSnippet = true;
						let m = lines[i].match(regex_snippet);
						let childSnippetName = m[1].trim();
						retContentLines.push(parse_snippet_content(childSnippetName, level + 1) || lines[i]);
					} else {
						retContentLines.push(lines[i]);
					}
				}
				return retContentLines.join('\n') + '\n';
			} else {
				logToFile('not found ' + fullPath);
				return null;
			}
		}
		if (snippetName) line = parse_snippet_content(snippetName, 0) || line;
	} else if (line.match(/\[\[.+]]/)) {
		//Patch WIKI link
		//Wiki link, a bit more complicated
		//I use this syntax heavily in Telekasten
		let outputString = line.replace(regex_wiki, (match, p1) => {
			let fullPath = path.resolve(dir_of_current_md, p1.match(/^.+\.(.+)$/) ? p1 : p1 + '.md');
			// const fullPath = path.resolve(p1);
			// const fileName = path.basename(p1);
			const fileExists = fs.existsSync(fullPath);
			if (fileExists) {
				let mySer = serNumber;
				let myKey = getKeyByValue(fn_stores, fullPath);
				if (!myKey) {
					myKey = `fn_${mySer}`;
					serNumber = serNumber + 1;
					fn_stores[myKey] = fullPath;
				}
				//Give it 'zettel' class, so the display style of zettel can be easily customized later
				return `<span class="zettel"><a href="/zettel/${myKey}">${p1}</a></spa>`;
			} else {
				//also highlight missing zettel file
				return `<span class="notfound">${p1}</span>`;
			}
		});
		line = outputString;
	} else if (line.match(regex_link)) {
		//Patch local MD link
		//如果是 [name](link) 方式
		let outputString = line.replace(regex_link, (match, p1, p2) => {
			if (isValidUrl(p2)) {
				//if link is valid url, return normal Markdown link
				return `[${p1}](${p2})`;
			} else {
				//if a wiki style link to a local file
				//convert it to SMP_LINK handler
				let fn = path.resolve(dir_of_current_md, p2);
				return `[${p1}](/SMP_LINK/${Buffer.from(fn).toString('base64')})`;
			}
		});
		// logToFile(`Replace [${line}] to [${outputString}]`);
		line = outputString;
	}
	return patchLineNr ? `${line}${indicator(lnr)}` : line;
};

const init = async () => {
	const server = Hapi.server({
		port: 3030,
		host: '127.0.0.1',
		routes: {
			files: {
				relativeTo: path.join(__dirname, 'public'),
			},
		},
	});
	await server.register(require('@hapi/inert'));

	server.route({
		method: 'GET',
		path: '/{param*}',
		handler: {
			directory: {
				path: '.',
				redirectToSlash: true,
			},
		},
	});

	server.route({
		method: 'GET',
		path: '/',
		handler: (request, h) => {
			return 'Hello Simple Markdown Preview!';
		},
	});
	server.route({
		method: 'GET',
		path: '/preview/{bufnr}',
		handler: (request, h) => {
			let md_cache = string_stores['bufnr_' + request.params.bufnr];
			if (md_cache) {
				const data = marked.parse(md_cache.string);
				const resp_html =
					getStylesheet() +
					'<article class="markdown-body">' +
					indicator(-1) +
					data +
					'</article>' +
					getSmoothScrollScript(request.params.bufnr, md_cache.pos[0], md_cache.thisline.trim());
				return h.response(resp_html);
			} else {
				return h.response('Not found');
			}
		},
	});
	server.route({
		method: 'GET',
		path: '/SMP_LINK/{fn}',
		handler: (request, h) => {
			let fn = Buffer.from(request.params.fn, 'base64').toString();
			return h.file(fn, { confine: false });
		},
	});
	server.route({
		method: 'GET',
		path: '/getupdate/{bufnr}/{ts}',
		handler: (request, h) => {
			let { bufnr, ts } = request.params;
			function getResponse() {
				let md_cache = string_stores['bufnr_' + bufnr];
				if (md_cache) {
					if (md_cache.ts !== Number(ts)) {
						if (md_cache.touched[0]) {
							const data = marked.parse(md_cache.string);
							return h.response({
								code: 'touched_all',
								html: data,
								linenr: md_cache.pos[0],
								thisline: md_cache.thisline.trim(),
								ts: md_cache.ts,
							});
						} else if (md_cache.touched[1]) {
							return h.response({
								code: 'touched_line',
								linenr: md_cache.pos[0],
								thisline: md_cache.thisline.trim(),
								ts: md_cache.ts,
							});
						} else {
							return h.response({
								code: 'touched_none',
								ts: md_cache.ts,
							});
						}
					} else {
						return h.response({ code: 'notouch' });
					}
				} else {
					return h.response({ code: 'nocache' });
				}
			}

			return getResponse();
		},
	});
	server.route({
		method: 'GET',
		path: '/zettel/{myKey}',
		handler: (request, h) => {
			// Compile
			let fn = fn_stores[request.params.myKey];
			const fileExists = fs.existsSync(fn);
			if (fileExists) {
				logToFile('Zettel file sent:' + fn);
				let dir_of_current_md = path.dirname(fn);
				let md = fs.readFileSync(fn, 'utf8');
				md = patchLine(md, 0, dir_of_current_md, false);
				const data = marked.parse(md);

				return h.response(
					getStylesheet() + '<article class="markdown-body">' + data + '</article>',
				);
			} else {
				logToFile('Zettel not found: ' + fn);
				return h.response('Not found');
			}
		},
	});
	server.route({
		method: 'POST',
		path: '/config',
		handler: (request, h) => {
			let payload = request.payload;
			if (payload.cssfile) {
				if (fs.existsSync(payload.cssfile)) {
					smpConfig.css = `http://127.0.0.1:3030/SMP_LINK/${Buffer.from(payload.cssfile).toString(
						'base64',
					)}`;
				} else {
					smpConfig.css = defaultMarkDownCss;
					logToFile('css does not exist: ' + payload.cssfile);
				}
			}
			const keys = ['snippets_folder'];
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				smpConfig[key] = payload[key];
			}
			logToFile('config updated: ' + JSON.stringify(smpConfig, null, 2));
			return h.response('config updated');
		},
	});
	server.route({
		method: 'POST',
		path: '/update',
		handler: (request, h) => {
			let payload = request.payload;
			let fn = payload.fn;
			let codeStart = -1;
			let codeEnd = -1;
			let patched = [];
			let pure = [];
			let lines = payload.lines;
			if (!fn) {
				payload.lines.splice(1, payload.lines.length - 1, '...');
				logToFile('Filename is undefined, bypass update ' + JSON.stringify(payload));
				return h.response('Filename is undefined, bypass update');
			}
			let dir_of_current_md = path.dirname(fn);
			let codeLang = '';
			if (lines.length > 0 && lines[0] !== 'NO_CHANGE') {
				//update content
				for (let i = 0; i < lines.length; i++) {
					let x = lines[i];
					pure.push(x);
					patched.push(patchLine(lines[i], i, dir_of_current_md, true));

					if (x.match(/^\s*`/)) {
						//a code block start
						if (codeStart < 0) {
							codeStart = i;
							let match = x.match(/```(\w*)/);
							if (match) {
								codeLang = match[1];
							} else {
								codeLang = '';
							}
						} else codeEnd = i;
						if (codeEnd > 0) {
							for (let j = codeStart; j <= codeEnd; j++) {
								patched[j] = pure[j];
							}
							if (imagelizedLang.indexOf(codeLang) >= 0) {
								//for imagelized text, no auto scroll
								//Befote the code start
								//insert a indicator after a new line mark
								patched[codeStart] =
									'&nbsp;' + indicator(codeStart, true) + '\n' + patched[codeStart];

								//For those markdown lines which will be converted
								//into a picture, we insert patch, only used for hightlight
								//without scroll to it,
								//Why do we need no-scroll-to location? because if you are
								//editing a imagelizable mardown section which have many lines
								//or when you move cursor whithin this area
								//the browser will jump to this location
								//make your editting exprience unstable.
								patched[codeEnd] += '\n&nbsp;' + indicator(codeStart + 1, false);
							}
							codeStart = -1;
							codeEnd = -1;
							codeLang = '';
						}
					}
				}
				let md_string = patched.join('\n');
				// logToFile(
				// 	'Reeived ... ' +
				// 		payload.lines.length +
				// 		' lines, pos:' +
				// 		payload.pos +
				// 		', fn:' +
				// 		payload.fn,
				// );
				// fs.writeFile('/Users/lucas/tmp/buf1.md', md_string, 'utf8', (err) => {
				// 	if (err) {
				// 		console.error('Error writing file:', err);
				// 	} else {
				// 		console.log('File written successfully');
				// 	}
				// });
				// logToFile('Write store for bufnr ' + payload.bufnr);
				string_stores['bufnr_' + payload.bufnr] = {
					string: md_string,
					pos: payload.pos,
					fn: payload.fn,
					thisline: payload.thisline,
					touched: [true, true], //touch content and linenr
					ts: new Date().getTime(),
				};
			} else {
				logToFile('Update buf ' + payload.bufnr + ' pos to ' + JSON.stringify(payload.pos));
				let store = string_stores['bufnr_' + payload.bufnr];
				if (store) {
					string_stores['bufnr_' + payload.bufnr] = {
						string: store.string,
						pos: payload.pos,
						fn: payload.fn,
						thisline: payload.thisline,
						touched: [false, true], //touch linenr only
						ts: new Date().getTime(),
					};
				}
			}
			let ret = `Bufnr: ${payload.bufnr}, Pos: ${payload.pos}, Stores: ${
				Object.keys(string_stores).length
			} `;
			const response = h.response(ret);
			response.header('Connection', 'keep-alive');
			return response;
		},
	});
	server.route({
		method: 'POST',
		path: '/stop',
		handler: (request, h) => {
			logToFile('Receive stop request, stop now!!!');
			setTimeout(() => {
				process.exit(1);
			}, 1000);
			return 'Stopped';
		},
	});

	await server.start();
	logToFile('Server running on ' + server.info.uri);
};

process.on('unhandledRejection', (err) => {
	console.log(err);
	process.exit(1);
});

init();
