#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var cwd = process.cwd();
var moduleFolders = process.argv.slice(2);

console.log('DEPS (%s) %j', cwd, moduleFolders);

collectDeps(cwd, moduleFolders)
  .then(function(deps){
    console.log(deps);
    console.log('OK');
  })
  .catch(function(err){
    console.log(err.stack||err);
  })
;


//

function collectDeps(cwd, folders) {
  return readPackage(cwd).then(function(cwdPkg){
    return readAllFolders(folders)
      .then(readAllPackages)
      .then(function(pkgs){
        var results = {
          dependencies: cwdPkg.dependencies ? JSON.parse(JSON.stringify(cwdPkg.dependencies)) : {},
          devDependencies: cwdPkg.devDependencies ? JSON.parse(JSON.stringify(cwdPkg.devDependencies)) : {}
        };
        pkgs.forEach(function(pkg){
          updateDeps(pkg.dependencies, results.dependencies, pkg);
          updateDeps(pkg.devDependencies, results.devDependencies, pkg);
        });
        return results;
      })
      .then(function(pkg){
        updateDeps(pkg.dependencies, cwdPkg.dependencies, cwdPkg);
        updateDeps(pkg.devDependencies, cwdPkg.devDependencies, cwdPkg);
        delete cwdPkg.__dirname;
        return acfs_writeFile(path.join(cwd, 'package.json'), JSON.stringify(cwdPkg, null, '  ')+'\n').then(function(){
          return cwdPkg;
        });
      })
    ;
  });
}

function updateDeps(deps, depsAll, pkg) {
  if(deps) {
    Object.keys(deps).forEach(function(key){
      if(depsAll[key] != null && depsAll[key] !== deps[key]) {
        throw new Error('Missmatching versions of "'+key+'" "'+depsAll[key]+'" !== "'+deps[key]+'" in "'+pkg.name+'" ('+pkg.__dirname+')');
      }
      depsAll[key] = deps[key];
    });
  }
}

function readAllFolders(folders) {
  return Promise.all(folders.map(function(p){
    return acfs_readFolder(p).then(function(files){
      return files.map(function(f){
        return path.join(p, f);
      });
    });
  }))
    .then(function(r){
      return r.reduce(function(r,d){
        return r.concat(d);
      }, []);
    })
  ;
}

function readAllPackages(files) {
  return new Promise(function(resolve, reject) {
    var pending = files.length, pkgs = [];
    if(files.length === 0) return resolve(pkgs);
    files.forEach(function(file){
      readPackage(file)
        .then(function(pkg){
          pkgs.push(pkg);
          check();
        })
        .catch(check)
      ;
    });
    function check() {
      if(--pending === 0) {
        resolve(pkgs);
      }
    }
  });
}

function readPackage(file) {
  return acfs_readFile(path.join(file, 'package.json'))
    .then(function(d){
      d = JSON.parse(d.toString());
      d.__dirname = file;
      return d;
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

function acfs_writeFile(p, d) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(p, d, function(err){
      if(err) return reject(err);
      resolve();
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

// Folders

function acfs_readFolder(p) {
  return new Promise(function(resolve, reject) {
    fs.readdir(p, function(err, files){
      if(err) return reject(err);
      resolve(files);
    });
  });
}
