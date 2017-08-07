/******************************
HSBC Personal Statement to CSV
v0.5
Copyright: Benjie Gillam (2012)
License: WTFPL v2.0 ( http://en.wikipedia.org/wiki/WTFPL )
Instructions:
Add the following bookmarklet to your browser:
javascript:(function(s)%7Bvar%20e%3Ddocument.createElement('script')%3Be.src%3Ds%3Bdocument.head.appendChild(e)%3B%7D)('https%3A%2F%2Fraw.github.com%2Fgist%2F2157849%2FHSBC.js')
Open this bookmarklet when you are looking at a previous statement or recent
transactions in HSBC personal online banking and it will bring up a CSV copy of
your transactions from that statement/list that you can copy to your clipboard
and paste into a file (e.g. to import into Xero or similar services).
Changelog:
v0.5 - Add AJAX fetching of a full year of statements.
v0.4.1 - Add status updates for AJAX fetches.
v0.4 - Add AJAX fetching of extra information for abbreviated transactions
v0.3 - Fix dates for accounts with Overdraft Limits
v0.2 - Adds support for recent transactions, fixes balance=0
v0.1 - initial release
Compatibility: only tested in Chrome 17 under Mac OS X against my own accounts.
Use at your own risk. Educational purposes only. Etc etc.
******************************/
var textarea = null;
var superarray = [];
var additionalPending = 0;
var statementPending = 0;
var errorOccurred = false;
var ascending = true;

var div = document.createElement('div');
var h1 = document.createElement('h1');
h1.innerText = "Double-click to dismiss";
//div.insertBefore(h1,div.firstChild);
div.appendChild(h1);
div.appendChild(document.createTextNode("Date, Transaction Type, Payee, Amount, Balance (GBP)"));
textarea = document.createElement('textarea');
textarea.style.width="100%";
textarea.style.height = "80%";
textarea.value = "If this message remains, then an error has occurred";
div.appendChild(textarea);
div.style.position="fixed";
div.style.top = "100px";
div.style.bottom = "100px";
div.style.border = "10px solid black";
div.style.borderRadius = "25px";
div.style.padding = "20px";
div.style.left = "100px";
div.style.right = "100px";
div.style.zIndex = "100";
div.style.backgroundColor = "white";
div.addEventListener('dblclick',function(e) {
  div.parentNode.removeChild(div);
},false);
document.body.appendChild(div);

function checkFinished() {
  if (errorOccurred) {
    div.style.backgroundColor = "red";
  }
  if (additionalPending+statementPending == 0) {
    done();
  } else {
    textarea.value = additionalPending+" additional info fetches remaining; "+statementPending+" statements fetches remaining...";
  }
};
function done() {
  superarray.reverse();
  var results = [];
  for (var j = 0; j < superarray.length; j++) {
    var array = superarray[j];
    if (!ascending) {
      array.reverse();
    }
    for (var i = 0; i<array.length; i++) {
      results.push(array[i].join(","));
    }
  }
  csv = results.join("\n");
  textarea.value = csv;
  textarea.focus();
  textarea.select();
}
function parseStatement(statement,$,$rootEl,array) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var previous = true;
  var tmp = $rootEl.find("div .hsbcTextRight").first()[0].innerText.split(" ");
  if (tmp.length > 4) {
    tmp = $rootEl.find("div .extPibRow .extTableColumn2").eq(2)[0].innerText.split(" ");
    previous = false;
  }
  var statementDay = parseInt(tmp[0].replace(/^0/,""));
  var statementMonth = months.indexOf(tmp[1]);
  var statementYear = parseInt(tmp[2]);

  if (statementMonth == 0 && ascending) {
    statementYear--;
  }

  var table = $rootEl.find(".containerMain table").eq(1);
  var trs = table.find('tbody tr');

  var currentMonth = statementMonth;
  var currentBalance = 0;
  for (var i = 0, l = trs.length; i<l; i++) {
    var tr = trs.eq(i);
    if (previous && (i == 0 || i == l-1)) {
      currentBalance = parseFloat(tr.find('td')[5].innerText);
      // Skip "Balance brought/carried forward" lines
      continue;
    }
    (function(){
      var row = [];
      var tds = tr.find('td');
      var amount = 0;
      for (var j = 0, m = tds.length; j<m; j++) {
        if (j >= 6) {
          continue;
        }
        var td = tds[j];
        var skip = false;
        str = td.innerText;
        if (!previous) {
          var tmp = str.split("\n");
          for (var k = 0; k < tmp.length; k++) {
            tmp[k] = $.trim(tmp[k]);
          }
          str = tmp.join("\n");
          str = str.replace(/\n\n/g,"\n");
        }
        str = str.replace(/[\v\0\r\t]/g," ");
        str = str.replace(/(^ | (?= )| $)/g,"");
        str = str.replace(/"/g,"\\\"");
        str = $.trim(str);
        str = str.replace(/\n/g, " | ");
        if (j == 0) {
          tmp = str.split(" ");
          var day = parseInt(tmp[0].replace(/^0/,""));
          var month = months.indexOf(tmp[1]);
          if (currentMonth == 11 && month == 0) {
            statementYear++;
          }
          currentMonth = month;
          strMonth = ""+(month+1);
          if (strMonth.length < 2) {
            strMonth = "0"+strMonth;
          }
          strDay = ""+day;
          if (strDay.length < 2) {
            strDay = "0"+strDay;
          }
          str = ""+statementYear+"-"+strMonth+"-"+strDay;
        }
        if (j < 3) {
          str = "\""+str+"\"";
          if (j == 2) {
            // AJAX fetch more details.
            var a = tds.eq(j).find("a");
            if (a && a.length) {
              var href = a.attr("href");
              console.log("Additional: "+statement+" :: "+a[0].innerText);
              additionalPending++;
              $.ajax({
                url:href
              }).done(function(data){
                var a = data.indexOf("<strong>Additional details:</strong>");
                if (a != -1) {
                  var relevant = data.substr(a,1000);
                  relevant = relevant.replace(/^[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*$/,"$1");
                  relevant = relevant.replace(/<br \/>/g,"");
                  relevant = $.trim(relevant);
                  var tmp = relevant.split("\n");
                  for (var i = 0; i < tmp.length; i++) {
                    tmp[i] = $.trim(tmp[i]);
                  }
                  relevant = tmp.join("\n");
                  relevant = relevant.replace(/\n\n/g,"\n");
                  relevant = relevant.replace(/\n/g," | ");
                  row[2] = "\""+relevant+"\"";
                  console.log(relevant);
                }
                additionalPending--;
                checkFinished();
              });
            }
          }
        } else {
          str = parseFloat(str);
          if (isNaN(str)) {
            str = 0.0;
          }
          if (j == 3) {
            amount -= str;
            skip = true;
          } else if (j == 4) {
            amount += str;
            str = amount;
          } else if (j == 5) {
            if (previous) {
              if (str == 0.0) {
                currentBalance = str = parseInt((currentBalance + amount)*100)/100;
              } else {
                currentBalance = str;
              }
            }
          }
        }
        if (!skip) {
          row.push(str);
        }
      }
      array.push(row);
    })();
  }
  checkFinished();
}
(function($){
  var trs = $(".hsbcMainContent table.hsbcRowSeparator tr");
  if (!trs || trs.length < 2) {
    var array = [];
    superarray.push(array);
    parseStatement("Current Page", $, $(document.body), array);
  } else {
    for (var i = 1; i<trs.length; i++) {
      (function(){
        var a = trs.eq(i).find("td a").eq(0);
        var href = a.attr("href");
        var array = [];
        superarray.push(array);
        if (href && href.length) {
          // Fetch it
          statement = a[0].innerText;
          console.log("Statement: "+statement);
          statementPending++;
          $.ajax({
            url:href
          }).done(function(data){
            data = data.replace(/^[\s\S]*<body[^>]*>([\s\S]*)<\/body[\s\S]*$/,"$1");
            var div = document.createElement('div');
            div.innerHTML = data;
            var $div = $(div);
            parseStatement(statement, $, $div, array);
            statementPending--;
            checkFinished();
          });
        } else {
          console.error("One of the links doesn't work!!");
          errorOccurred = true;
        }
      })();
    }
  }
})(jQuery);
checkFinished();
