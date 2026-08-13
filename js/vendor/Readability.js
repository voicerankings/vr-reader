/*
 * Copyright (c) 2010 Arc90 Inc
 * [MODERNIZED by Gemini - 2025]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This code is heavily based on Arc90's readability.js (1.7.1) script
 * available at: http://code.google.com/p/arc90labs-readability
 */

/**
 * Public constructor.
 * @param {HTMLDocument|HTMLElement} docOrElement The document or element to parse.
 * @param {Object}       options The options object.
 */
function Readability(docOrElement, options) {
  // MODERNIZATION: Allow passing an HTMLElement directly.
  // If an element is passed, we create a minimal document in memory to work with.
  if (docOrElement.nodeType && (docOrElement.nodeType === docOrElement.ELEMENT_NODE)) {
    const ownerDoc = docOrElement.ownerDocument;
    const newDoc = ownerDoc.implementation.createHTMLDocument();
    
    // Set the baseURI for the new doc so relative URLs can be resolved.
    // Use the live page's base URI as the reference.
    if (ownerDoc.baseURI) {
        const base = newDoc.createElement("base");
        base.href = ownerDoc.baseURI;
        newDoc.head.appendChild(base);
    }
    
    newDoc.body.appendChild(newDoc.importNode(docOrElement, true));
    
    docOrElement = newDoc;
    // The original 'options' becomes the second argument
    options = arguments[1] || {};
  } else if (!docOrElement || !docOrElement.documentElement) {
    throw new Error(
      "First argument to Readability constructor should be a document or element object."
    );
  }
  
  options = options || {};
  
  // The rest of the constructor remains largely the same...
  this._doc = docOrElement;
  this._docJSDOMParser = this._doc.firstChild && this._doc.firstChild.__JSDOMParser__;
  this._articleTitle = null;
  this._articleByline = null;
  this._articleDir = null;
  this._articleSiteName = null;
  this._attempts = [];
  this._metadata = {};

  // Configurable options
  this._debug = !!options.debug;
  this._maxElemsToParse =
    options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
  this._nbTopCandidates =
    options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
  this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
  this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(
    options.classesToPreserve || []
  );
  this._keepClasses = !!options.keepClasses;
  this._serializer =
    options.serializer ||
    function (el) {
      return el.innerHTML;
    };
  this._disableJSONLD = !!options.disableJSONLD;
  this._allowedVideoRegex = options.allowedVideoRegex || this.REGEXPS.videos;
  this._linkDensityModifier = options.linkDensityModifier || 0;

  // Start with all flags set
  this._flags =
    this.FLAG_STRIP_UNLIKELYS |
    this.FLAG_WEIGHT_CLASSES |
    this.FLAG_CLEAN_CONDITIONALLY;

  // Control whether log messages are sent to the console
  if (this._debug) {
    let logNode = function (node) {
      if (node.nodeType == node.TEXT_NODE) {
        return `${node.nodeName} ("${node.textContent}")`;
      }
      let attrPairs = Array.from(node.attributes || [], function (attr) {
        return `${attr.name}="${attr.value}"`;
      }).join(" ");
      return `<${node.localName} ${attrPairs}>`;
    };
    this.log = function () {
      if (typeof console !== "undefined") {
        let args = Array.from(arguments, arg => {
          if (arg && arg.nodeType == this.ELEMENT_NODE) {
            return logNode(arg);
          }
          return arg;
        });
        args.unshift("Reader: (Readability)");
        // eslint-disable-next-line no-console
        console.log(...args);
      }
    };
  } else {
    this.log = function () {};
  }
}

Readability.prototype = {
  FLAG_STRIP_UNLIKELYS: 0x1,
  FLAG_WEIGHT_CLASSES: 0x2,
  FLAG_CLEAN_CONDITIONALLY: 0x4,

  ELEMENT_NODE: 1,
  TEXT_NODE: 3,

  DEFAULT_MAX_ELEMS_TO_PARSE: 0,
  DEFAULT_N_TOP_CANDIDATES: 5,
  DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre"
    .toUpperCase()
    .split(","),
  DEFAULT_CHAR_THRESHOLD: 500,

  REGEXPS: {
    // MODERNIZATION: Added more patterns for modern junk like cookie banners, modals, etc.
    unlikelyCandidates:
      /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote|cookie|modal|overlay|newsletter|signup|social-share/i,
    okMaybeItsACandidate:
      /and|article|body|column|content|main|mathjax|shadow/i,
    // MODERNIZATION: Added more positive patterns for modern content wrappers and CSS frameworks.
    positive:
      /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story|prose|post-body|article-content|article-body/i,
    negative:
      /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|footer|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|widget/i,
    extraneous:
      /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
    byline: /byline|author|dateline|writtenby|p-author/i,
    replaceFonts: /<(\/?)font[^>]*>/gi,
    normalize: /\s{2,}/g,
    videos:
      /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq|bilibili|live.bilibili)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
    shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
    nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
    prevLink: /(prev|earl|old|new|<|«)/i,
    tokenize: /\W+/g,
    whitespace: /^\s*$/,
    hasContent: /\S$/,
    hashUrl: /^#.+/,
    srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
    b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
    commas: /\u002C|\u060C|\uFE50|\uFE10|\uFE11|\u2E41|\u2E34|\u2E32|\uFF0C/g,
    jsonLdArticleTypes:
      /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPosting|BlogPosting|LiveBlogPosting|DiscussionForumPosting|TechArticle|APIReference$/,
    adWords:
      /^(ad(vertising|vertisement)?|pub(licité)?|werb(ung)?|广告|Реклама|Anuncio)$/iu,
    loadingWords:
      /^((loading|正在加载|Загрузка|chargement|cargando)(…|\.\.\.)?)$/iu,
  },

  UNLIKELY_ROLES: [
    "menu",
    "menubar",
    "complementary",
    "navigation",
    "alert",
    "alertdialog",
    "dialog",
    "banner",
    "search"
  ],

  DIV_TO_P_ELEMS: new Set([
    "BLOCKQUOTE",
    "DL",
    "DIV",
    "IMG",
    "OL",
    "P",
    "PRE",
    "TABLE",
    "UL",
  ]),

  ALTER_TO_DIV_EXCEPTIONS: ["DIV", "ARTICLE", "SECTION", "P", "OL", "UL"],

  PRESENTATIONAL_ATTRIBUTES: [
    "align",
    "background",
    "bgcolor",
    "border",
    "cellpadding",
    "cellspacing",
    "frame",
    "hspace",
    "rules",
    "style",
    "valign",
    "vspace",
  ],

  DEPRECATED_SIZE_ATTRIBUTE_ELEMS: ["TABLE", "TH", "TD", "HR", "PRE"],

  PHRASING_ELEMS: [
    "ABBR", "AUDIO", "B", "BDO", "BR", "BUTTON", "CITE", "CODE", "DATA",
    "DATALIST", "DFN", "EM", "EMBED", "I", "IMG", "INPUT", "KBD", "LABEL",
    "MARK", "MATH", "METER", "NOSCRIPT", "OBJECT", "OUTPUT", "PROGRESS",
    "Q", "RUBY", "SAMP", "SCRIPT", "SELECT", "SMALL", "SPAN", "STRONG",
    "SUB", "SUP", "TEXTAREA", "TIME", "VAR", "WBR",
  ],

  CLASSES_TO_PRESERVE: ["page"],

  HTML_ESCAPE_MAP: {
    lt: "<",
    gt: ">",
    amp: "&",
    quot: '"',
    apos: "'",
  },
  
  // MODERNIZATION: Add a new function to handle Shadow DOM content.
  /**
   * Recursively traverses a document tree and "flattens" shadow DOM roots
   * by replacing the host element with its shadow content. This makes
   * content within web components visible to the main parsing algorithm.
   * @param {DocumentOrShadowRoot} rootNode
   */
  _flattenShadowDOM(rootNode) {
    // Use try-catch as this can fail on certain browser-internal elements.
    try {
        const allElements = rootNode.querySelectorAll('*');
        allElements.forEach(element => {
          if (element.shadowRoot) {
            // This is a shadow host.
            const shadowRoot = element.shadowRoot;
            // Recurse inside the shadow DOM first to handle nested components.
            this._flattenShadowDOM(shadowRoot);
            
            // Create a fragment to hold the shadow content.
            const fragment = document.createDocumentFragment();
            // Move all children from shadow root to the fragment.
            while (shadowRoot.firstChild) {
              fragment.appendChild(shadowRoot.firstChild);
            }
            // Replace the host element with its flattened content.
            element.parentNode.replaceChild(fragment, element);
          }
        });
    } catch(e) {
        this.log("Error flattening shadow DOM, probably on a protected element.", e);
    }
  },

  _postProcessContent(articleContent) {
    this._fixRelativeUris(articleContent);
    this._simplifyNestedElements(articleContent);
    if (!this._keepClasses) {
      this._cleanClasses(articleContent);
    }
  },

  _removeNodes(nodeList, filterFn) {
    if (this._docJSDOMParser && nodeList._isLiveNodeList) {
      throw new Error("Do not pass live node lists to _removeNodes");
    }
    for (var i = nodeList.length - 1; i >= 0; i--) {
      var node = nodeList[i];
      var parentNode = node.parentNode;
      if (parentNode) {
        if (!filterFn || filterFn.call(this, node, i, nodeList)) {
          parentNode.removeChild(node);
        }
      }
    }
  },

  _replaceNodeTags(nodeList, newTagName) {
    if (this._docJSDOMParser && nodeList._isLiveNodeList) {
      throw new Error("Do not pass live node lists to _replaceNodeTags");
    }
    for (const node of nodeList) {
      this._setNodeTag(node, newTagName);
    }
  },

  _forEachNode(nodeList, fn) {
    Array.prototype.forEach.call(nodeList, fn, this);
  },

  _findNode(nodeList, fn) {
    return Array.prototype.find.call(nodeList, fn, this);
  },

  _someNode(nodeList, fn) {
    return Array.prototype.some.call(nodeList, fn, this);
  },

  _everyNode(nodeList, fn) {
    return Array.prototype.every.call(nodeList, fn, this);
  },

  _getAllNodesWithTag(node, tagNames) {
    if (node.querySelectorAll) {
      return node.querySelectorAll(tagNames.join(","));
    }
    return [].concat.apply(
      [],
      tagNames.map(function (tag) {
        var collection = node.getElementsByTagName(tag);
        return Array.isArray(collection) ? collection : Array.from(collection);
      })
    );
  },

  _cleanClasses(node) {
    var classesToPreserve = this._classesToPreserve;
    var className = (node.getAttribute("class") || "")
      .split(/\s+/)
      .filter(cls => classesToPreserve.includes(cls))
      .join(" ");

    if (className) {
      node.setAttribute("class", className);
    } else {
      node.removeAttribute("class");
    }

    for (node = node.firstElementChild; node; node = node.nextElementSibling) {
      this._cleanClasses(node);
    }
  },
  
  _isUrl(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },
  
  _fixRelativeUris(articleContent) {
    var baseURI = this._doc.baseURI;
    var documentURI = this._doc.documentURI;
    function toAbsoluteURI(uri) {
      if (baseURI == documentURI && uri.charAt(0) == "#") {
        return uri;
      }
      try {
        return new URL(uri, baseURI).href;
      } catch (ex) {}
      return uri;
    }

    var links = this._getAllNodesWithTag(articleContent, ["a"]);
    this._forEachNode(links, function (link) {
      var href = link.getAttribute("href");
      if (href) {
        if (href.indexOf("javascript:") === 0) {
          if (link.childNodes.length === 1 && link.childNodes[0].nodeType === this.TEXT_NODE) {
            var text = this._doc.createTextNode(link.textContent);
            link.parentNode.replaceChild(text, link);
          } else {
            var container = this._doc.createElement("span");
            while (link.firstChild) {
              container.appendChild(link.firstChild);
            }
            link.parentNode.replaceChild(container, link);
          }
        } else {
          link.setAttribute("href", toAbsoluteURI(href));
        }
      }
    });

    var medias = this._getAllNodesWithTag(articleContent, [
      "img", "picture", "figure", "video", "audio", "source",
    ]);

    this._forEachNode(medias, function (media) {
      var src = media.getAttribute("src");
      var poster = media.getAttribute("poster");
      var srcset = media.getAttribute("srcset");

      if (src) media.setAttribute("src", toAbsoluteURI(src));
      if (poster) media.setAttribute("poster", toAbsoluteURI(poster));
      if (srcset) {
        var newSrcset = srcset.replace(
          this.REGEXPS.srcsetUrl,
          function (_, p1, p2, p3) {
            return toAbsoluteURI(p1) + (p2 || "") + p3;
          }
        );
        media.setAttribute("srcset", newSrcset);
      }
    });
  },

  _simplifyNestedElements(articleContent) {
    var node = articleContent;
    while (node) {
      if (node.parentNode && ["DIV", "SECTION"].includes(node.tagName) && !(node.id && node.id.startsWith("readability"))) {
        if (this._isElementWithoutContent(node)) {
          node = this._removeAndGetNext(node);
          continue;
        } else if (this._hasSingleTagInsideElement(node, "DIV") || this._hasSingleTagInsideElement(node, "SECTION")) {
          var child = node.children[0];
          for (var i = 0; i < node.attributes.length; i++) {
            child.setAttributeNode(node.attributes[i].cloneNode());
          }
          node.parentNode.replaceChild(child, node);
          node = child;
          continue;
        }
      }
      node = this._getNextNode(node);
    }
  },

  _getArticleTitle() {
    var doc = this._doc;
    var curTitle = "";
    var origTitle = "";
    try {
      curTitle = origTitle = doc.title.trim();
      if (typeof curTitle !== "string") {
        curTitle = origTitle = this._getInnerText(doc.getElementsByTagName("title")[0]);
      }
    } catch (e) {}

    var titleHadHierarchicalSeparators = false;
    function wordCount(str) { return str.split(/\s+/).length; }

    const titleSeparators = /\|\-–—\\\/>»/.source;
    if (new RegExp(`\\s[${titleSeparators}]\\s`).test(curTitle)) {
      titleHadHierarchicalSeparators = /\s[\\\/>»]\s/.test(curTitle);
      let allSeparators = Array.from(origTitle.matchAll(new RegExp(`\\s[${titleSeparators}]\\s`, "gi")));
      curTitle = origTitle.substring(0, allSeparators.pop().index);
      if (wordCount(curTitle) < 3) {
        curTitle = origTitle.replace(new RegExp(`^[^${titleSeparators}]*[${titleSeparators}]`, "gi"), "");
      }
    } else if (curTitle.includes(": ")) {
      var headings = this._getAllNodesWithTag(doc, ["h1", "h2"]);
      var trimmedTitle = curTitle.trim();
      var match = this._someNode(headings, function (heading) { return heading.textContent.trim() === trimmedTitle; });
      if (!match) {
        curTitle = origTitle.substring(origTitle.lastIndexOf(":") + 1);
        if (wordCount(curTitle) < 3) {
          curTitle = origTitle.substring(origTitle.indexOf(":") + 1);
        } else if (wordCount(origTitle.substr(0, origTitle.indexOf(":"))) > 5) {
          curTitle = origTitle;
        }
      }
    } else if (curTitle.length > 150 || curTitle.length < 15) {
      var hOnes = doc.getElementsByTagName("h1");
      if (hOnes.length === 1) {
        curTitle = this._getInnerText(hOnes[0]);
      }
    }
    curTitle = curTitle.trim().replace(this.REGEXPS.normalize, " ");
    var curTitleWordCount = wordCount(curTitle);
    if (curTitleWordCount <= 4 && (!titleHadHierarchicalSeparators || curTitleWordCount != wordCount(origTitle.replace(new RegExp(`\\s[${titleSeparators}]\\s`, "g"), "")) - 1)) {
      curTitle = origTitle;
    }
    return curTitle;
  },

  _prepDocument() {
    var doc = this._doc;
    this._removeNodes(this._getAllNodesWithTag(doc, ["style"]));
    if (doc.body) {
      this._replaceBrs(doc.body);
    }
    this._replaceNodeTags(this._getAllNodesWithTag(doc, ["font"]), "SPAN");
  },

  _nextNode(node) {
    var next = node;
    while (next && next.nodeType != this.ELEMENT_NODE && this.REGEXPS.whitespace.test(next.textContent)) {
      next = next.nextSibling;
    }
    return next;
  },

  _replaceBrs(elem) {
    this._forEachNode(this._getAllNodesWithTag(elem, ["br"]), function (br) {
      var next = br.nextSibling;
      var replaced = false;
      while ((next = this._nextNode(next)) && next.tagName == "BR") {
        replaced = true;
        var brSibling = next.nextSibling;
        next.remove();
        next = brSibling;
      }
      if (replaced) {
        var p = this._doc.createElement("p");
        br.parentNode.replaceChild(p, br);
        next = p.nextSibling;
        while (next) {
          if (next.tagName == "BR") {
            var nextElem = this._nextNode(next.nextSibling);
            if (nextElem && nextElem.tagName == "BR") break;
          }
          if (!this._isPhrasingContent(next)) break;
          var sibling = next.nextSibling;
          p.appendChild(next);
          next = sibling;
        }
        while (p.lastChild && this._isWhitespace(p.lastChild)) {
          p.lastChild.remove();
        }
        if (p.parentNode.tagName === "P") {
          this._setNodeTag(p.parentNode, "DIV");
        }
      }
    });
  },

  _setNodeTag(node, tag) {
    if (this._docJSDOMParser) {
      node.localName = tag.toLowerCase();
      node.tagName = tag.toUpperCase();
      return node;
    }
    var replacement = node.ownerDocument.createElement(tag);
    while (node.firstChild) {
      replacement.appendChild(node.firstChild);
    }
    node.parentNode.replaceChild(replacement, node);
    if (node.readability) {
      replacement.readability = node.readability;
    }
    for (var i = 0; i < node.attributes.length; i++) {
      replacement.setAttributeNode(node.attributes[i].cloneNode());
    }
    return replacement;
  },

  _prepArticle(articleContent) {
    this._cleanStyles(articleContent);
    this._markDataTables(articleContent);
    this._fixLazyImages(articleContent);
    this._cleanConditionally(articleContent, "form");
    this._cleanConditionally(articleContent, "fieldset");
    this._clean(articleContent, "object");
    this._clean(articleContent, "embed");
    this._clean(articleContent, "footer");
    this._clean(articleContent, "link");
    this._clean(articleContent, "aside");

    var shareElementThreshold = this.DEFAULT_CHAR_THRESHOLD;
    this._forEachNode(articleContent.children, function (topCandidate) {
      this._cleanMatchedNodes(topCandidate, function (node, matchString) {
        return (this.REGEXPS.shareElements.test(matchString) && node.textContent.length < shareElementThreshold);
      });
    });

    this._clean(articleContent, "iframe");
    this._clean(articleContent, "input");
    this._clean(articleContent, "textarea");
    this._clean(articleContent, "select");
    this._clean(articleContent, "button");
    this._cleanHeaders(articleContent);
    this._cleanConditionally(articleContent, "table");
    this._cleanConditionally(articleContent, "ul");
    this._cleanConditionally(articleContent, "div");
    this._replaceNodeTags(this._getAllNodesWithTag(articleContent, ["h1"]), "h2");
    this._removeNodes(this._getAllNodesWithTag(articleContent, ["p"]), function (paragraph) {
      var contentElementCount = this._getAllNodesWithTag(paragraph, ["img", "embed", "object", "iframe"]).length;
      return (contentElementCount === 0 && !this._getInnerText(paragraph, false));
    });

    this._forEachNode(this._getAllNodesWithTag(articleContent, ["br"]), function (br) {
      var next = this._nextNode(br.nextSibling);
      if (next && next.tagName == "P") br.remove();
    });

    this._forEachNode(this._getAllNodesWithTag(articleContent, ["table"]), function (table) {
      var tbody = this._hasSingleTagInsideElement(table, "TBODY") ? table.firstElementChild : table;
      if (this._hasSingleTagInsideElement(tbody, "TR")) {
        var row = tbody.firstElementChild;
        if (this._hasSingleTagInsideElement(row, "TD")) {
          var cell = row.firstElementChild;
          cell = this._setNodeTag(cell, this._everyNode(cell.childNodes, this._isPhrasingContent) ? "P" : "DIV");
          table.parentNode.replaceChild(cell, table);
        }
      }
    });
  },

  _initializeNode(node) {
    node.readability = { contentScore: 0 };
    switch (node.tagName) {
      // MODERNIZATION: Give a strong positive score to modern semantic tags.
      case "MAIN":
        node.readability.contentScore += 25;
        break;
      case "ARTICLE":
        node.readability.contentScore += 20;
        break;
      case "DIV":
        node.readability.contentScore += 5;
        break;
      case "PRE":
      case "TD":
      case "BLOCKQUOTE":
        node.readability.contentScore += 3;
        break;
      case "ADDRESS":
      case "OL":
      case "UL":
      case "DL":
      case "DD":
      case "DT":
      case "LI":
      case "FORM":
        node.readability.contentScore -= 3;
        break;
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6":
      case "TH":
        node.readability.contentScore -= 5;
        break;
    }
    node.readability.contentScore += this._getClassWeight(node);
  },

  _removeAndGetNext(node) {
    var nextNode = this._getNextNode(node, true);
    node.remove();
    return nextNode;
  },

  _getNextNode(node, ignoreSelfAndKids) {
    if (!ignoreSelfAndKids && node.firstElementChild) return node.firstElementChild;
    if (node.nextElementSibling) return node.nextElementSibling;
    do {
      node = node.parentNode;
    } while (node && !node.nextElementSibling);
    return node && node.nextElementSibling;
  },

  _textSimilarity(textA, textB) {
    var tokensA = textA.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
    var tokensB = textB.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
    if (!tokensA.length || !tokensB.length) return 0;
    var uniqTokensB = tokensB.filter(token => !tokensA.includes(token));
    var distanceB = uniqTokensB.join(" ").length / tokensB.join(" ").length;
    return 1 - distanceB;
  },

  _isValidByline(node, matchString) {
    var rel = node.getAttribute("rel");
    var itemprop = node.getAttribute("itemprop");
    var bylineLength = node.textContent.trim().length;
    return ((rel === "author" || (itemprop && itemprop.includes("author")) || this.REGEXPS.byline.test(matchString)) && bylineLength > 0 && bylineLength < 100);
  },

  _getNodeAncestors(node, maxDepth) {
    maxDepth = maxDepth || 0;
    var i = 0, ancestors = [];
    while (node.parentNode) {
      ancestors.push(node.parentNode);
      if (maxDepth && ++i === maxDepth) break;
      node = node.parentNode;
    }
    return ancestors;
  },

  _grabArticle(page) {
    var doc = this._doc;
    var isPaging = page !== null;
    page = page ? page : this._doc.body;
    if (!page) return null;

    var pageCacheHtml = page.innerHTML;

    while (true) {
      var stripUnlikelyCandidates = this._flagIsActive(this.FLAG_STRIP_UNLIKELYS);
      var elementsToScore = [];
      var node = this._doc.documentElement;
      let shouldRemoveTitleHeader = true;

      while (node) {
        if (node.tagName === "HTML") this._articleLang = node.getAttribute("lang");
        var matchString = node.className + " " + node.id;
        if (!this._isProbablyVisible(node)) {
          node = this._removeAndGetNext(node);
          continue;
        }
        if (node.getAttribute("aria-modal") == "true" && node.getAttribute("role") == "dialog") {
          node = this._removeAndGetNext(node);
          continue;
        }
        if (!this._articleByline && !this._metadata.byline && this._isValidByline(node, matchString)) {
          var endOfSearchMarkerNode = this._getNextNode(node, true);
          var next = this._getNextNode(node);
          var itemPropNameNode = null;
          while (next && next != endOfSearchMarkerNode) {
            var itemprop = next.getAttribute("itemprop");
            if (itemprop && itemprop.includes("name")) {
              itemPropNameNode = next;
              break;
            } else {
              next = this._getNextNode(next);
            }
          }
          this._articleByline = (itemPropNameNode ?? node).textContent.trim();
          node = this._removeAndGetNext(node);
          continue;
        }
        if (shouldRemoveTitleHeader && this._headerDuplicatesTitle(node)) {
          shouldRemoveTitleHeader = false;
          node = this._removeAndGetNext(node);
          continue;
        }
        if (stripUnlikelyCandidates) {
          if (this.REGEXPS.unlikelyCandidates.test(matchString) && !this.REGEXPS.okMaybeItsACandidate.test(matchString) && !this._hasAncestorTag(node, "table") && !this._hasAncestorTag(node, "code") && node.tagName !== "BODY" && node.tagName !== "A") {
            node = this._removeAndGetNext(node);
            continue;
          }
          if (this.UNLIKELY_ROLES.includes(node.getAttribute("role"))) {
            node = this._removeAndGetNext(node);
            continue;
          }
        }
        if ((node.tagName === "DIV" || node.tagName === "SECTION" || node.tagName === "HEADER" || node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3" || node.tagName === "H4" || node.tagName === "H5" || node.tagName === "H6") && this._isElementWithoutContent(node)) {
          node = this._removeAndGetNext(node);
          continue;
        }
        if (this.DEFAULT_TAGS_TO_SCORE.includes(node.tagName)) {
          elementsToScore.push(node);
        }
        if (node.tagName === "DIV") {
          var childNode = node.firstChild;
          while (childNode) {
            var nextSibling = childNode.nextSibling;
            if (this._isPhrasingContent(childNode)) {
              var fragment = doc.createDocumentFragment();
              do {
                nextSibling = childNode.nextSibling;
                fragment.appendChild(childNode);
                childNode = nextSibling;
              } while (childNode && this._isPhrasingContent(childNode));
              while (fragment.firstChild && this._isWhitespace(fragment.firstChild)) fragment.firstChild.remove();
              while (fragment.lastChild && this._isWhitespace(fragment.lastChild)) fragment.lastChild.remove();
              if (fragment.firstChild) {
                var p = doc.createElement("p");
                p.appendChild(fragment);
                node.insertBefore(p, nextSibling);
              }
            }
            childNode = nextSibling;
          }
          if (this._hasSingleTagInsideElement(node, "P") && this._getLinkDensity(node) < 0.25) {
            var newNode = node.children[0];
            node.parentNode.replaceChild(newNode, node);
            node = newNode;
            elementsToScore.push(node);
          } else if (!this._hasChildBlockElement(node)) {
            node = this._setNodeTag(node, "P");
            elementsToScore.push(node);
          }
        }
        node = this._getNextNode(node);
      }

      var candidates = [];
      this._forEachNode(elementsToScore, function (elementToScore) {
        if (!elementToScore.parentNode || typeof elementToScore.parentNode.tagName === "undefined") return;
        var innerText = this._getInnerText(elementToScore);
        if (innerText.length < 25) return;
        var ancestors = this._getNodeAncestors(elementToScore, 5);
        if (ancestors.length === 0) return;
        var contentScore = 1 + innerText.split(this.REGEXPS.commas).length + Math.min(Math.floor(innerText.length / 100), 3);
        this._forEachNode(ancestors, function (ancestor, level) {
          if (!ancestor.tagName || !ancestor.parentNode || typeof ancestor.parentNode.tagName === "undefined") return;
          if (typeof ancestor.readability === "undefined") {
            this._initializeNode(ancestor);
            candidates.push(ancestor);
          }
          var scoreDivider = (level === 0) ? 1 : (level === 1) ? 2 : level * 3;
          ancestor.readability.contentScore += contentScore / scoreDivider;
        });
      });

      var topCandidates = [];
      for (var c = 0, cl = candidates.length; c < cl; c += 1) {
        var candidate = candidates[c];
        var candidateScore = candidate.readability.contentScore * (1 - this._getLinkDensity(candidate));
        candidate.readability.contentScore = candidateScore;
        for (var t = 0; t < this._nbTopCandidates; t++) {
          var aTopCandidate = topCandidates[t];
          if (!aTopCandidate || candidateScore > aTopCandidate.readability.contentScore) {
            topCandidates.splice(t, 0, candidate);
            if (topCandidates.length > this._nbTopCandidates) topCandidates.pop();
            break;
          }
        }
      }

      var topCandidate = topCandidates[0] || null;
      var neededToCreateTopCandidate = false;
      var parentOfTopCandidate;
      if (topCandidate === null || topCandidate.tagName === "BODY") {
        topCandidate = doc.createElement("DIV");
        neededToCreateTopCandidate = true;
        while (page.firstChild) topCandidate.appendChild(page.firstChild);
        page.appendChild(topCandidate);
        this._initializeNode(topCandidate);
      } else if (topCandidate) {
        var alternativeCandidateAncestors = [];
        for (var i = 1; i < topCandidates.length; i++) {
          if (topCandidates[i].readability.contentScore / topCandidate.readability.contentScore >= 0.75) {
            alternativeCandidateAncestors.push(this._getNodeAncestors(topCandidates[i]));
          }
        }
        var MINIMUM_TOPCANDIDATES = 3;
        if (alternativeCandidateAncestors.length >= MINIMUM_TOPCANDIDATES) {
          parentOfTopCandidate = topCandidate.parentNode;
          while (parentOfTopCandidate.tagName !== "BODY") {
            var listsContainingThisAncestor = 0;
            for (var ancestorIndex = 0; ancestorIndex < alternativeCandidateAncestors.length && listsContainingThisAncestor < MINIMUM_TOPCANDIDATES; ancestorIndex++) {
              listsContainingThisAncestor += Number(alternativeCandidateAncestors[ancestorIndex].includes(parentOfTopCandidate));
            }
            if (listsContainingThisAncestor >= MINIMUM_TOPCANDIDATES) {
              topCandidate = parentOfTopCandidate;
              break;
            }
            parentOfTopCandidate = parentOfTopCandidate.parentNode;
          }
        }
        if (!topCandidate.readability) this._initializeNode(topCandidate);
        parentOfTopCandidate = topCandidate.parentNode;
        var lastScore = topCandidate.readability.contentScore;
        var scoreThreshold = lastScore / 3;
        while (parentOfTopCandidate.tagName !== "BODY") {
          if (!parentOfTopCandidate.readability) {
            parentOfTopCandidate = parentOfTopCandidate.parentNode;
            continue;
          }
          var parentScore = parentOfTopCandidate.readability.contentScore;
          if (parentScore < scoreThreshold) break;
          if (parentScore > lastScore) {
            topCandidate = parentOfTopCandidate;
            break;
          }
          lastScore = parentOfTopCandidate.readability.contentScore;
          parentOfTopCandidate = parentOfTopCandidate.parentNode;
        }
        parentOfTopCandidate = topCandidate.parentNode;
        while (parentOfTopCandidate.tagName != "BODY" && parentOfTopCandidate.children.length == 1) {
          topCandidate = parentOfTopCandidate;
          parentOfTopCandidate = topCandidate.parentNode;
        }
        if (!topCandidate.readability) this._initializeNode(topCandidate);
      }
      
      var articleContent = doc.createElement("DIV");
      if (isPaging) articleContent.id = "readability-content";
      var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
      parentOfTopCandidate = topCandidate.parentNode;
      var siblings = parentOfTopCandidate.children;
      for (var s = 0, sl = siblings.length; s < sl; s++) {
        var sibling = siblings[s];
        var append = false;
        if (sibling === topCandidate) {
          append = true;
        } else {
          var contentBonus = 0;
          if (sibling.className === topCandidate.className && topCandidate.className !== "") {
            contentBonus += topCandidate.readability.contentScore * 0.2;
          }
          if (sibling.readability && (sibling.readability.contentScore + contentBonus >= siblingScoreThreshold)) {
            append = true;
          } else if (sibling.nodeName === "P") {
            var linkDensity = this._getLinkDensity(sibling);
            var nodeContent = this._getInnerText(sibling);
            var nodeLength = nodeContent.length;
            if (nodeLength > 80 && linkDensity < 0.25) append = true;
            else if (nodeLength < 80 && nodeLength > 0 && linkDensity === 0 && nodeContent.search(/\.( |$)/) !== -1) append = true;
          }
        }
        if (append) {
          if (!this.ALTER_TO_DIV_EXCEPTIONS.includes(sibling.nodeName)) {
            sibling = this._setNodeTag(sibling, "DIV");
          }
          articleContent.appendChild(sibling);
          siblings = parentOfTopCandidate.children;
          s -= 1;
          sl -= 1;
        }
      }
      
      this._prepArticle(articleContent);
      if (neededToCreateTopCandidate) {
        topCandidate.id = "readability-page-1";
        topCandidate.className = "page";
      } else {
        var div = doc.createElement("DIV");
        div.id = "readability-page-1";
        div.className = "page";
        while (articleContent.firstChild) div.appendChild(articleContent.firstChild);
        articleContent.appendChild(div);
      }

      var parseSuccessful = true;
      var textLength = this._getInnerText(articleContent, true).length;
      if (textLength < this._charThreshold) {
        parseSuccessful = false;
        page.innerHTML = pageCacheHtml;
        this._attempts.push({ articleContent, textLength });
        if (this._flagIsActive(this.FLAG_STRIP_UNLIKELYS)) this._removeFlag(this.FLAG_STRIP_UNLIKELYS);
        else if (this._flagIsActive(this.FLAG_WEIGHT_CLASSES)) this._removeFlag(this.FLAG_WEIGHT_CLASSES);
        else if (this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)) this._removeFlag(this.FLAG_CLEAN_CONDITIONALLY);
        else {
          this._attempts.sort((a, b) => b.textLength - a.textLength);
          if (!this._attempts.length || !this._attempts[0].textLength) return null;
          articleContent = this._attempts[0].articleContent;
          parseSuccessful = true;
        }
      }
      if (parseSuccessful) {
        var ancestors = [parentOfTopCandidate, topCandidate].concat(this._getNodeAncestors(parentOfTopCandidate));
        this._someNode(ancestors, (ancestor) => {
          if (!ancestor.tagName) return false;
          var articleDir = ancestor.getAttribute("dir");
          if (articleDir) {
            this._articleDir = articleDir;
            return true;
          }
          return false;
        });
        return articleContent;
      }
    }
  },

  _unescapeHtmlEntities(str) {
    if (!str) return str;
    var htmlEscapeMap = this.HTML_ESCAPE_MAP;
    return str.replace(/&(quot|amp|apos|lt|gt);/g, (_, tag) => htmlEscapeMap[tag])
      .replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_, hex, numStr) => {
        var num = parseInt(hex || numStr, hex ? 16 : 10);
        if (num === 0 || num > 0x10ffff || (num >= 0xd800 && num <= 0xdfff)) {
          num = 0xfffd;
        }
        return String.fromCodePoint(num);
      });
  },

  _getJSONLD(doc) {
    var scripts = this._getAllNodesWithTag(doc, ["script"]);
    var metadata;
    this._forEachNode(scripts, function (jsonLdElement) {
      if (!metadata && jsonLdElement.getAttribute("type") === "application/ld+json") {
        try {
          var content = jsonLdElement.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "");
          var parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            parsed = parsed.find(it => it["@type"] && it["@type"].match(this.REGEXPS.jsonLdArticleTypes));
            if (!parsed) return;
          }
          var schemaDotOrgRegex = /^https?\:\/\/schema\.org\/?$/;
          var matches = (typeof parsed["@context"] === "string" && parsed["@context"].match(schemaDotOrgRegex)) || (typeof parsed["@context"] === "object" && typeof parsed["@context"]["@vocab"] == "string" && parsed["@context"]["@vocab"].match(schemaDotOrgRegex));
          if (!matches) return;
          if (!parsed["@type"] && Array.isArray(parsed["@graph"])) {
            parsed = parsed["@graph"].find(it => (it["@type"] || "").match(this.REGEXPS.jsonLdArticleTypes));
          }
          if (!parsed || !parsed["@type"] || !parsed["@type"].match(this.REGEXPS.jsonLdArticleTypes)) return;
          metadata = {};
          if (typeof parsed.name === "string" && typeof parsed.headline === "string" && parsed.name !== parsed.headline) {
            var title = this._getArticleTitle();
            var nameMatches = this._textSimilarity(parsed.name, title) > 0.75;
            var headlineMatches = this._textSimilarity(parsed.headline, title) > 0.75;
            metadata.title = (headlineMatches && !nameMatches) ? parsed.headline : parsed.name;
          } else if (typeof parsed.name === "string") {
            metadata.title = parsed.name.trim();
          } else if (typeof parsed.headline === "string") {
            metadata.title = parsed.headline.trim();
          }
          if (parsed.author) {
            if (typeof parsed.author.name === "string") {
              metadata.byline = parsed.author.name.trim();
            } else if (Array.isArray(parsed.author) && parsed.author[0] && typeof parsed.author[0].name === "string") {
              metadata.byline = parsed.author.filter(author => author && typeof author.name === "string").map(author => author.name.trim()).join(", ");
            }
          }
          if (typeof parsed.description === "string") metadata.excerpt = parsed.description.trim();
          if (parsed.publisher && typeof parsed.publisher.name === "string") metadata.siteName = parsed.publisher.name.trim();
          if (typeof parsed.datePublished === "string") metadata.datePublished = parsed.datePublished.trim();
        } catch (err) {
          this.log(err.message);
        }
      }
    });
    return metadata ? metadata : {};
  },
  
  _getArticleMetadata(jsonld) {
    var metadata = {};
    var values = {};
    var metaElements = this._doc.getElementsByTagName("meta");
    var propertyPattern = /\s*(article|dc|dcterm|og|twitter)\s*:\s*(author|creator|description|published_time|title|site_name)\s*/gi;
    var namePattern = /^\s*(?:(dc|dcterm|og|twitter|parsely|weibo:(article|webpage))\s*[-\.:]\s*)?(author|creator|pub-date|description|title|site_name)\s*$/i;

    this._forEachNode(metaElements, function (element) {
      var elementName = element.getAttribute("name");
      var elementProperty = element.getAttribute("property");
      var content = element.getAttribute("content");
      if (!content) return;
      var matches = null;
      var name = null;
      if (elementProperty) {
        matches = elementProperty.match(propertyPattern);
        if (matches) {
          name = matches[0].toLowerCase().replace(/\s/g, "");
          values[name] = content.trim();
        }
      }
      if (!matches && elementName && namePattern.test(elementName)) {
        name = elementName.toLowerCase().replace(/\s/g, "").replace(/\./g, ":");
        values[name] = content.trim();
      }
    });

    metadata.title = jsonld.title || values["dc:title"] || values["dcterm:title"] || values["og:title"] || values["weibo:article:title"] || values["weibo:webpage:title"] || values.title || values["twitter:title"] || values["parsely-title"];
    if (!metadata.title) metadata.title = this._getArticleTitle();
    const articleAuthor = typeof values["article:author"] === "string" && !this._isUrl(values["article:author"]) ? values["article:author"] : undefined;
    metadata.byline = jsonld.byline || values["dc:creator"] || values["dcterm:creator"] || values.author || values["parsely-author"] || articleAuthor;
    metadata.excerpt = jsonld.excerpt || values["dc:description"] || values["dcterm:description"] || values["og:description"] || values["weibo:article:description"] || values["weibo:webpage:description"] || values.description || values["twitter:description"];
    metadata.siteName = jsonld.siteName || values["og:site_name"];
    metadata.publishedTime = jsonld.datePublished || values["article:published_time"] || values["parsely-pub-date"] || null;

    metadata.title = this._unescapeHtmlEntities(metadata.title);
    metadata.byline = this._unescapeHtmlEntities(metadata.byline);
    metadata.excerpt = this._unescapeHtmlEntities(metadata.excerpt);
    metadata.siteName = this._unescapeHtmlEntities(metadata.siteName);
    metadata.publishedTime = this._unescapeHtmlEntities(metadata.publishedTime);

    return metadata;
  },

  _isSingleImage(node) {
    while (node) {
      if (node.tagName === "IMG") return true;
      if (node.children.length !== 1 || node.textContent.trim() !== "") return false;
      node = node.children[0];
    }
    return false;
  },

  _unwrapNoscriptImages(doc) {
    var imgs = Array.from(doc.getElementsByTagName("img"));
    this._forEachNode(imgs, function (img) {
      for (var i = 0; i < img.attributes.length; i++) {
        var attr = img.attributes[i];
        switch (attr.name) {
          case "src":
          case "srcset":
          case "data-src":
          case "data-srcset":
            return;
        }
        if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) return;
      }
      img.remove();
    });

    var noscripts = Array.from(doc.getElementsByTagName("noscript"));
    this._forEachNode(noscripts, function (noscript) {
      if (!this._isSingleImage(noscript)) return;
      var tmp = doc.createElement("div");
      tmp.innerHTML = noscript.innerHTML;
      var prevElement = noscript.previousElementSibling;
      if (prevElement && this._isSingleImage(prevElement)) {
        var prevImg = (prevElement.tagName !== "IMG") ? prevElement.getElementsByTagName("img")[0] : prevElement;
        var newImg = tmp.getElementsByTagName("img")[0];
        for (var i = 0; i < prevImg.attributes.length; i++) {
          var attr = prevImg.attributes[i];
          if (attr.value === "") continue;
          if (attr.name === "src" || attr.name === "srcset" || /\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
            if (newImg.getAttribute(attr.name) === attr.value) continue;
            var attrName = attr.name;
            if (newImg.hasAttribute(attrName)) attrName = "data-old-" + attrName;
            newImg.setAttribute(attrName, attr.value);
          }
        }
        noscript.parentNode.replaceChild(tmp.firstElementChild, prevElement);
      }
    });
  },

  _removeScripts(doc) {
    this._removeNodes(this._getAllNodesWithTag(doc, ["script", "noscript"]));
  },

  _hasSingleTagInsideElement(element, tag) {
    if (element.children.length != 1 || element.children[0].tagName !== tag) return false;
    return !this._someNode(element.childNodes, (node) => node.nodeType === this.TEXT_NODE && this.REGEXPS.hasContent.test(node.textContent));
  },

  _isElementWithoutContent(node) {
    return (node.nodeType === this.ELEMENT_NODE && node.textContent.trim().length === 0 && (!node.children.length || node.children.length == node.getElementsByTagName("br").length + node.getElementsByTagName("hr").length));
  },

  _hasChildBlockElement(element) {
    return this._someNode(element.childNodes, (node) => this.DIV_TO_P_ELEMS.has(node.tagName) || this._hasChildBlockElement(node));
  },

  _isPhrasingContent(node) {
    return (node.nodeType === this.TEXT_NODE || this.PHRASING_ELEMS.includes(node.tagName) || ((node.tagName === "A" || node.tagName === "DEL" || node.tagName === "INS") && this._everyNode(node.childNodes, this._isPhrasingContent)));
  },

  _isWhitespace(node) {
    return ((node.nodeType === this.TEXT_NODE && node.textContent.trim().length === 0) || (node.nodeType === this.ELEMENT_NODE && node.tagName === "BR"));
  },

  _getInnerText(e, normalizeSpaces) {
    normalizeSpaces = typeof normalizeSpaces === "undefined" ? true : normalizeSpaces;
    var textContent = e.textContent.trim();
    return normalizeSpaces ? textContent.replace(this.REGEXPS.normalize, " ") : textContent;
  },

  _getCharCount(e, s) {
    s = s || ",";
    return this._getInnerText(e).split(s).length - 1;
  },

  _cleanStyles(e) {
    if (!e || e.tagName.toLowerCase() === "svg") return;
    for (var i = 0; i < this.PRESENTATIONAL_ATTRIBUTES.length; i++) {
      e.removeAttribute(this.PRESENTATIONAL_ATTRIBUTES[i]);
    }
    if (this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS.includes(e.tagName)) {
      e.removeAttribute("width");
      e.removeAttribute("height");
    }
    var cur = e.firstElementChild;
    while (cur !== null) {
      this._cleanStyles(cur);
      cur = cur.nextElementSibling;
    }
  },

  _getLinkDensity(element) {
    var textLength = this._getInnerText(element).length;
    if (textLength === 0) return 0;
    var linkLength = 0;
    this._forEachNode(element.getElementsByTagName("a"), function (linkNode) {
      var href = linkNode.getAttribute("href");
      var coefficient = href && this.REGEXPS.hashUrl.test(href) ? 0.3 : 1;
      linkLength += this._getInnerText(linkNode).length * coefficient;
    });
    return linkLength / textLength;
  },

  _getClassWeight(e) {
    if (!this._flagIsActive(this.FLAG_WEIGHT_CLASSES)) return 0;
    var weight = 0;
    if (typeof e.className === "string" && e.className !== "") {
      if (this.REGEXPS.negative.test(e.className)) weight -= 25;
      if (this.REGEXPS.positive.test(e.className)) weight += 25;
    }
    if (typeof e.id === "string" && e.id !== "") {
      if (this.REGEXPS.negative.test(e.id)) weight -= 25;
      if (this.REGEXPS.positive.test(e.id)) weight += 25;
    }
    return weight;
  },

  _clean(e, tag) {
    var isEmbed = ["object", "embed", "iframe"].includes(tag);
    this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (element) {
      if (isEmbed) {
        for (var i = 0; i < element.attributes.length; i++) {
          if (this._allowedVideoRegex.test(element.attributes[i].value)) return false;
        }
        if (element.tagName === "object" && this._allowedVideoRegex.test(element.innerHTML)) return false;
      }
      return true;
    });
  },

  _hasAncestorTag(node, tagName, maxDepth, filterFn) {
    maxDepth = maxDepth || 3;
    tagName = tagName.toUpperCase();
    var depth = 0;
    while (node.parentNode) {
      if (maxDepth > 0 && depth > maxDepth) return false;
      if (node.parentNode.tagName === tagName && (!filterFn || filterFn(node.parentNode))) return true;
      node = node.parentNode;
      depth++;
    }
    return false;
  },

  _getRowAndColumnCount(table) {
    var rows = 0;
    var columns = 0;
    var trs = table.getElementsByTagName("tr");
    for (var i = 0; i < trs.length; i++) {
      var rowspan = parseInt(trs[i].getAttribute("rowspan"), 10) || 1;
      rows += rowspan;
      var columnsInThisRow = 0;
      var cells = trs[i].getElementsByTagName("td");
      for (var j = 0; j < cells.length; j++) {
        var colspan = parseInt(cells[j].getAttribute("colspan"), 10) || 1;
        columnsInThisRow += colspan;
      }
      columns = Math.max(columns, columnsInThisRow);
    }
    return { rows, columns };
  },

  _markDataTables(root) {
    var tables = root.getElementsByTagName("table");
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.getAttribute("role") == "presentation") {
        table._readabilityDataTable = false;
        continue;
      }
      if (table.getAttribute("datatable") == "0") {
        table._readabilityDataTable = false;
        continue;
      }
      if (table.getAttribute("summary")) {
        table._readabilityDataTable = true;
        continue;
      }
      if (table.getElementsByTagName("caption")[0]) {
        table._readabilityDataTable = true;
        continue;
      }
      var dataTableDescendants = ["col", "colgroup", "tfoot", "thead", "th"];
      if (dataTableDescendants.some(tag => !!table.getElementsByTagName(tag)[0])) {
        table._readabilityDataTable = true;
        continue;
      }
      if (table.getElementsByTagName("table")[0]) {
        table._readabilityDataTable = false;
        continue;
      }
      var sizeInfo = this._getRowAndColumnCount(table);
      if (sizeInfo.rows >= 10 || sizeInfo.columns > 4) {
        table._readabilityDataTable = true;
        continue;
      }
      table._readabilityDataTable = sizeInfo.rows * sizeInfo.columns > 10;
    }
  },

  _fixLazyImages(root) {
    this._forEachNode(this._getAllNodesWithTag(root, ["img", "picture", "figure"]), function (elem) {
        const lazyAttributes = ["data-src", "data-srcset", "data-original", "data-url"];
        if (elem.tagName === "IMG" && elem.loading === "lazy" && !elem.src) {
           for (const attr of lazyAttributes) {
                if (elem.hasAttribute(attr)) {
                    const src = elem.getAttribute(attr);
                    if (/\s+\d/.test(src)) {
                        elem.setAttribute("srcset", src);
                    } else {
                        elem.setAttribute("src", src);
                    }
                    break;
                }
           }
        }
        if (elem.src && this.REGEXPS.b64DataUrl.test(elem.src)) {
          var parts = this.REGEXPS.b64DataUrl.exec(elem.src);
          if (parts[1] === "image/svg+xml") return;
          var srcCouldBeRemoved = false;
          for (var i = 0; i < elem.attributes.length; i++) {
            var attr = elem.attributes[i];
            if (attr.name === "src") continue;
            if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
              srcCouldBeRemoved = true;
              break;
            }
          }
          if (srcCouldBeRemoved) {
            var b64starts = parts[0].length;
            if (elem.src.length - b64starts < 133) elem.removeAttribute("src");
          }
        }
        if ((elem.src || (elem.srcset && elem.srcset != "null")) && !elem.className.toLowerCase().includes("lazy")) return;
        for (var j = 0; j < elem.attributes.length; j++) {
          let attr = elem.attributes[j];
          if (attr.name === "src" || attr.name === "srcset" || attr.name === "alt") continue;
          var copyTo = null;
          if (/\.(jpg|jpeg|png|webp)\s+\d/.test(attr.value)) copyTo = "srcset";
          else if (/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(attr.value)) copyTo = "src";
          if (copyTo) {
            if (elem.tagName === "IMG" || elem.tagName === "PICTURE") {
              elem.setAttribute(copyTo, attr.value);
            } else if (elem.tagName === "FIGURE" && !this._getAllNodesWithTag(elem, ["img", "picture"]).length) {
              var img = this._doc.createElement("img");
              img.setAttribute(copyTo, attr.value);
              elem.appendChild(img);
            }
          }
        }
      }
    );
  },

  _getTextDensity(e, tags) {
    var textLength = this._getInnerText(e, true).length;
    if (textLength === 0) return 0;
    var childrenLength = 0;
    var children = this._getAllNodesWithTag(e, tags);
    this._forEachNode(children, child => (childrenLength += this._getInnerText(child, true).length));
    return childrenLength / textLength;
  },

  _cleanConditionally(e, tag) {
    if (!this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)) return;
    this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (node) {
      var isDataTable = (t) => t._readabilityDataTable;
      var isList = tag === "ul" || tag === "ol";
      if (!isList) {
        var listLength = 0;
        var listNodes = this._getAllNodesWithTag(node, ["ul", "ol"]);
        this._forEachNode(listNodes, list => (listLength += this._getInnerText(list).length));
        isList = listLength / this._getInnerText(node).length > 0.9;
      }
      if (tag === "table" && isDataTable(node)) return false;
      if (this._hasAncestorTag(node, "table", -1, isDataTable)) return false;
      if (this._hasAncestorTag(node, "code")) return false;
      if ([...node.getElementsByTagName("table")].some(tbl => tbl._readabilityDataTable)) return false;
      var weight = this._getClassWeight(node);
      var contentScore = 0;
      if (weight + contentScore < 0) return true;
      if (this._getCharCount(node, ",") < 10) {
        var p = node.getElementsByTagName("p").length;
        var img = node.getElementsByTagName("img").length;
        var li = node.getElementsByTagName("li").length - 100;
        var input = node.getElementsByTagName("input").length;
        var headingDensity = this._getTextDensity(node, ["h1", "h2", "h3", "h4", "h5", "h6"]);
        var embedCount = 0;
        var embeds = this._getAllNodesWithTag(node, ["object", "embed", "iframe"]);
        for (var i = 0; i < embeds.length; i++) {
          for (var j = 0; j < embeds[i].attributes.length; j++) {
            if (this._allowedVideoRegex.test(embeds[i].attributes[j].value)) return false;
          }
          if (embeds[i].tagName === "object" && this._allowedVideoRegex.test(embeds[i].innerHTML)) return false;
          embedCount++;
        }
        var innerText = this._getInnerText(node);
        if (this.REGEXPS.adWords.test(innerText) || this.REGEXPS.loadingWords.test(innerText)) return true;
        var contentLength = innerText.length;
        var linkDensity = this._getLinkDensity(node);
        var textishTags = ["SPAN", "LI", "TD"].concat(Array.from(this.DIV_TO_P_ELEMS));
        var textDensity = this._getTextDensity(node, textishTags);
        var isFigureChild = this._hasAncestorTag(node, "figure");

        const shouldRemoveNode = () => {
          if (!isFigureChild && img > 1 && p / img < 0.5) return true;
          if (!isList && li > p) return true;
          if (input > Math.floor(p / 3)) return true;
          if (!isList && !isFigureChild && headingDensity < 0.9 && contentLength < 25 && (img === 0 || img > 2) && linkDensity > 0) return true;
          if (!isList && weight < 25 && linkDensity > 0.2 + this._linkDensityModifier) return true;
          if (weight >= 25 && linkDensity > 0.5 + this._linkDensityModifier) return true;
          if ((embedCount === 1 && contentLength < 75) || embedCount > 1) return true;
          if (img === 0 && textDensity === 0) return true;
          return false;
        };

        var haveToRemove = shouldRemoveNode();
        if (isList && haveToRemove) {
          for (var x = 0; x < node.children.length; x++) {
            if (node.children[x].children.length > 1) return true;
          }
          if (img == node.getElementsByTagName("li").length) return false;
        }
        return haveToRemove;
      }
      return false;
    });
  },

  _cleanMatchedNodes(e, filter) {
    var endOfSearchMarkerNode = this._getNextNode(e, true);
    var next = this._getNextNode(e);
    while (next && next != endOfSearchMarkerNode) {
      if (filter.call(this, next, next.className + " " + next.id)) {
        next = this._removeAndGetNext(next);
      } else {
        next = this._getNextNode(next);
      }
    }
  },

  _cleanHeaders(e) {
    let headingNodes = this._getAllNodesWithTag(e, ["h1", "h2"]);
    this._removeNodes(headingNodes, (node) => this._getClassWeight(node) < 0);
  },

  _headerDuplicatesTitle(node) {
    if (node.tagName != "H1" && node.tagName != "H2") return false;
    var heading = this._getInnerText(node, false);
    return this._textSimilarity(this._articleTitle, heading) > 0.75;
  },

  _flagIsActive(flag) {
    return (this._flags & flag) > 0;
  },

  _removeFlag(flag) {
    this._flags = this._flags & ~flag;
  },

  _isProbablyVisible(node) {
    return ((!node.style || node.style.display != "none") && (!node.style || node.style.visibility != "hidden") && !node.hasAttribute("hidden") && (!node.hasAttribute("aria-hidden") || node.getAttribute("aria-hidden") != "true" || (node.className && node.className.includes && node.className.includes("fallback-image"))));
  },

  parse() {
    if (this._maxElemsToParse > 0 && this._doc.getElementsByTagName("*").length > this._maxElemsToParse) {
      throw new Error("Aborting parsing document; " + this._doc.getElementsByTagName("*").length + " elements found");
    }
    
    // MODERNIZATION: Flatten Shadow DOM before doing anything else.
    try {
        this._flattenShadowDOM(this._doc);
    } catch(e) {
        this.log("Could not flatten shadow DOM: ", e);
    }

    this._unwrapNoscriptImages(this._doc);
    var jsonLd = this._disableJSONLD ? {} : this._getJSONLD(this._doc);
    this._removeScripts(this._doc);
    this._prepDocument();
    var metadata = this._getArticleMetadata(jsonLd);
    this._metadata = metadata;
    this._articleTitle = metadata.title;

    var articleContent = this._grabArticle();
    if (!articleContent) {
      return null;
    }

    this._postProcessContent(articleContent);

    if (!metadata.excerpt) {
      var paragraphs = articleContent.getElementsByTagName("p");
      if (paragraphs.length) {
        metadata.excerpt = paragraphs[0].textContent.trim();
      }
    }

    var textContent = articleContent.textContent;
    return {
      title: this._articleTitle,
      byline: metadata.byline || this._articleByline,
      dir: this._articleDir,
      lang: this._articleLang,
      content: this._serializer(articleContent),
      textContent,
      length: textContent.length,
      excerpt: metadata.excerpt,
      siteName: metadata.siteName || this._articleSiteName,
      publishedTime: metadata.publishedTime,
    };
  },
};

if (typeof module === "object") {
  try {
    module.exports = Readability;
  } catch (e) {
    // ESM environments may expose a read-only module object; the
    // `export default` below is sufficient for those cases.
  }
}
export default Readability;