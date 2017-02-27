#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var promiseSettle = require('../lib/promise-settle');

var args = {
  linkSelf: false
};

var cwd = process.cwd();
var moduleFolders = process.argv.slice(2).filter(function(arg){
  if(arg === '--link-self') {
    args.linkSelf = true;
    return false;
  }
  return true;
});

console.log('LINKER (%s) %j', cwd, moduleFolders);

var MODULES_FOLDER = path.join(cwd, 'node_modules');

acfs_ensureFolder(MODULES_FOLDER)
  .then(function(){
    return removeAllSymlinks(MODULES_FOLDER)
      .then(function(){
        return promiseSettle(moduleFolders.map(function(folder){
          folder = path.resolve(folder);
          return linkModuleFolders(folder)
            .then(function(r){
              console.log('· Folder: %s', folder);
              var arr = r.filter(function(d){return d[0] == null;}).map(function(d){return d[1];});
              if(arr.length !== 0) {
                console.log('· · Linked modules: %s', arr.length);
                arr.forEach(function(d){
                  console.log('· · · %s: %s > %s', d.name, d.source, d.target);
                });
              }
              var errs = r.filter(function(d){return d[0] != null;}).map(function(d){return d[0];});
              if(errs.length !== 0) {
                console.error('· · Errors: %s (might be ok)', errs.length);
                errs.forEach(function(err){
                  console.error('· ·   %s', err.message||err.stack||err);
                });
              }
            })
          ;
        }));
      })
    ;
  })
  .then(function(){
    if(args.linkSelf) {
      // link self
      return linkModule(cwd);
    }
  })
  .then(function(err){
    console.log('DONE LINKER (%s)', cwd);
  })
  .catch(function(err){
    console.error('ERROR LINKER (%s)', cwd);
    console.error(err.stack||err);
  })
;

////

function getPackage(folder) {
  var filename = path.join(folder, 'package.json');
  return acfs_readJsonFile(filename)
    .then(function(d){
      d.__filename = filename;
      d.__dirname = folder;
      return d;
    })
  ;
}

function removeAllSymlinks(folder) {
  return acfs_readFolder(folder)
    .then(function(files){
      return promiseSettle(files.map(function(file){
        return unlinkModule(path.join(folder, file));
      }));
    })
  ;
}

function unlinkModule(folder) {
  return acfs_isSymlink(folder)
    .then(function(yes){
      if(!yes) {
        return false;
      }
      return acfs_unlink(folder)
        .then(function(){
          return true;
        })
      ;
    })
  ;
}

function linkModuleFolders(folder) {
  return acfs_readFolder(folder)
    .then(function(files){
      return promiseSettle(files.map(function(file){
        return getPackage(path.join(folder, file));
      }))
        .then(function(r){
          return promiseSettle(r.filter(function(d){
            return d[0] == null;
          }).map(function(d){
            return d[1];
          }).map(function(d){
            return linkModule(d.__dirname);
          }));
        })
      ;
    })
  ;
}

function linkModule(folder) {
  return getPackage(folder)
    .then(function(d){
      var name = d.name;
      var p = path.join(MODULES_FOLDER, name);
      return acfs_readlink(p)
        .then(function(d){
          if(d === folder) {
            return done();
          }
          // recreate symlink
          return acfs_unlink(p)
            .then(function(){
              return acfs_symlink(folder, p).then(done);
            })
          ;
        })
        .catch(function(){
          // create symlink
          return acfs_symlink(folder, p).then(done);
        })
      ;

      function done() {
        return {
          name: name,
          source: folder,
          target: p
        };
      }
    })
  ;
}

////////////////////////////////////////////////////////////////////////////////

// Files

function acfs_readFile(p) {
  return new Promise(function(resolve, reject) {
    fs.readFile(p, function(err, d){
      if(err) return reject(err);
      resolve(d);
    });
  });
}

function acfs_readJsonFile(p) {
  return acfs_readFile(p)
    .then(function(d){
      try {
        d = JSON.parse(d.toString());
      } catch(err) {
        return Promise.reject(err);
      }
      return d;
    })
  ;
}

function acfs_unlink(p) {
  return new Promise(function(resolve, reject) {
    fs.unlink(p, function(err){
      if(err) return reject(err);
      resolve();
    });
  });
}

// Folders

function acfs_readFolder(p) {
  return new Promise(function(resolve, reject) {
    fs.readdir(p, function(err, files){
      if(err) return reject(err);
      resolve(files);
    });
  });
}

function acfs_ensureFolder(p, mode) {
  return new Promise(function(resolve, reject) {
    fs.mkdir(p, mode||0777, function(err){
      if(err && err.code !== 'EEXIST') return reject(err);
      resolve();
    });
  });
}

// Symbolic Links

function acfs_symlink(linkTo, p, type) {
  if(type == null) type = 'junction';
  return new Promise(function(resolve, reject) {
    fs.symlink(linkTo, p, type, function(err){
      if(err) return reject(err);
      resolve();
    });
  });
}

function acfs_readlink(p) {
  return new Promise(function(resolve, reject) {
    fs.readlink(p, function(err, linkTo){
      if(err) return reject(err);
      resolve(linkTo);
    });
  });
}

function acfs_isSymlink(p) {
  return new Promise(function(resolve, reject) {
    fs.lstat(p, function(err, s){
      if(err) return reject(err);
      return resolve(s.isSymbolicLink());
    });
  });
}
