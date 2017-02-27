#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var promiseSettle = require('../lib/promise-settle');

console.log('LINKER (%s)', process.cwd());

var MODULES_FOLDER = 'node_modules';

acfs_ensureFolder(MODULES_FOLDER)
  .then(function(){
    return acfs_readJsonFile('linker.json')
      .then(function(config){
        var modules = config.modules;

        return removeAllSymlinks(MODULES_FOLDER)
          .then(function(){
            return promiseSettle(modules.map(function(folder){
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
                    console.error('· · Errors: %s', errs.length);
                    errs.forEach(function(err){
                      console.error(err.stack||err);
                    });
                  }
                })
              ;
            }));
          })
        ;
      })
      .then(function(){
        // link self
        return linkModule(path.resolve(__dirname, '..'));
      })
    ;
  })
  .then(function(err){
    console.log('DONE LINKER (%s)', process.cwd());
  })
  .catch(function(err){
    console.error('ERROR LINKER (%s)', process.cwd());
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
