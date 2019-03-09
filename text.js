async function* asyncGenerator(arr) {
  var i = 0;
  while (i < arr.length) {
    yield arr[i++];
  }
}

(async function() {
  for await (num of asyncGenerator([2, 3, 4, 5, 123])) {
    console.log(num);
  }
})();
