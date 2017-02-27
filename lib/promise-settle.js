
module.exports = promiseSettle;

function promiseSettle(arr) {
  return new Promise(function(resolve, reject) {
    var pending = arr.length;
    var results = new Array(pending);

    arr.forEach(function(promise, index){
      promise
        .then(function(d){
          results[index] = [null, d];
          check();
        })
        .catch(function(reason){
          results[index] = [reason, null];
          check();
        })
      ;
    });

    function check() {
      if(--pending === 0) resolve(results);
    }
  });
}
