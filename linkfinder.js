Array.prototype.unique = function() {
  return this.filter(function (value, index, self) { 
    return self.indexOf(value) === index;
  });
}

var links = []

var elements = document.getElementsByTagName('a')
for (var i = 0; i < elements.length; i++) {
	
	//console.log(elements[i].getAttribute("href"));
	links.push(elements[i].getAttribute("href"));
}

console.log(links.unique());
