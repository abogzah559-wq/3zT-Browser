"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../stubs/debug.js
var require_debug = __commonJS({
  "../../../stubs/debug.js"(exports2, module2) {
    module2.exports = function debug5() {
      const f = function() {
      };
      f.enabled = false;
      return f;
    };
    module2.exports.default = module2.exports;
  }
});

// ../../../adm-zip/util/constants.js
var require_constants = __commonJS({
  "../../../adm-zip/util/constants.js"(exports2, module2) {
    module2.exports = {
      /* The local file header */
      LOCHDR: 30,
      // LOC header size
      LOCSIG: 67324752,
      // "PK\003\004"
      LOCVER: 4,
      // version needed to extract
      LOCFLG: 6,
      // general purpose bit flag
      LOCHOW: 8,
      // compression method
      LOCTIM: 10,
      // modification time (2 bytes time, 2 bytes date)
      LOCCRC: 14,
      // uncompressed file crc-32 value
      LOCSIZ: 18,
      // compressed size
      LOCLEN: 22,
      // uncompressed size
      LOCNAM: 26,
      // filename length
      LOCEXT: 28,
      // extra field length
      /* The Data descriptor */
      EXTSIG: 134695760,
      // "PK\007\008"
      EXTHDR: 16,
      // EXT header size
      EXTCRC: 4,
      // uncompressed file crc-32 value
      EXTSIZ: 8,
      // compressed size
      EXTLEN: 12,
      // uncompressed size
      /* The central directory file header */
      CENHDR: 46,
      // CEN header size
      CENSIG: 33639248,
      // "PK\001\002"
      CENVEM: 4,
      // version made by
      CENVER: 6,
      // version needed to extract
      CENFLG: 8,
      // encrypt, decrypt flags
      CENHOW: 10,
      // compression method
      CENTIM: 12,
      // modification time (2 bytes time, 2 bytes date)
      CENCRC: 16,
      // uncompressed file crc-32 value
      CENSIZ: 20,
      // compressed size
      CENLEN: 24,
      // uncompressed size
      CENNAM: 28,
      // filename length
      CENEXT: 30,
      // extra field length
      CENCOM: 32,
      // file comment length
      CENDSK: 34,
      // volume number start
      CENATT: 36,
      // internal file attributes
      CENATX: 38,
      // external file attributes (host system dependent)
      CENOFF: 42,
      // LOC header offset
      /* The entries in the end of central directory */
      ENDHDR: 22,
      // END header size
      ENDSIG: 101010256,
      // "PK\005\006"
      ENDSUB: 8,
      // number of entries on this disk
      ENDTOT: 10,
      // total number of entries
      ENDSIZ: 12,
      // central directory size in bytes
      ENDOFF: 16,
      // offset of first CEN header
      ENDCOM: 20,
      // zip file comment length
      END64HDR: 20,
      // zip64 END header size
      END64SIG: 117853008,
      // zip64 Locator signature, "PK\006\007"
      END64START: 4,
      // number of the disk with the start of the zip64
      END64OFF: 8,
      // relative offset of the zip64 end of central directory
      END64NUMDISKS: 16,
      // total number of disks
      ZIP64SIG: 101075792,
      // zip64 signature, "PK\006\006"
      ZIP64HDR: 56,
      // zip64 record minimum size
      ZIP64LEAD: 12,
      // leading bytes at the start of the record, not counted by the value stored in ZIP64SIZE
      ZIP64SIZE: 4,
      // zip64 size of the central directory record
      ZIP64VEM: 12,
      // zip64 version made by
      ZIP64VER: 14,
      // zip64 version needed to extract
      ZIP64DSK: 16,
      // zip64 number of this disk
      ZIP64DSKDIR: 20,
      // number of the disk with the start of the record directory
      ZIP64SUB: 24,
      // number of entries on this disk
      ZIP64TOT: 32,
      // total number of entries
      ZIP64SIZB: 40,
      // zip64 central directory size in bytes
      ZIP64OFF: 48,
      // offset of start of central directory with respect to the starting disk number
      ZIP64EXTRA: 56,
      // extensible data sector
      /* Compression methods */
      STORED: 0,
      // no compression
      SHRUNK: 1,
      // shrunk
      REDUCED1: 2,
      // reduced with compression factor 1
      REDUCED2: 3,
      // reduced with compression factor 2
      REDUCED3: 4,
      // reduced with compression factor 3
      REDUCED4: 5,
      // reduced with compression factor 4
      IMPLODED: 6,
      // imploded
      // 7 reserved for Tokenizing compression algorithm
      DEFLATED: 8,
      // deflated
      ENHANCED_DEFLATED: 9,
      // enhanced deflated
      PKWARE: 10,
      // PKWare DCL imploded
      // 11 reserved by PKWARE
      BZIP2: 12,
      //  compressed using BZIP2
      // 13 reserved by PKWARE
      LZMA: 14,
      // LZMA
      // 15-17 reserved by PKWARE
      IBM_TERSE: 18,
      // compressed using IBM TERSE
      IBM_LZ77: 19,
      // IBM LZ77 z
      AES_ENCRYPT: 99,
      // WinZIP AES encryption method
      /* General purpose bit flag */
      // values can obtained with expression 2**bitnr
      FLG_ENC: 1,
      // Bit 0: encrypted file
      FLG_COMP1: 2,
      // Bit 1, compression option
      FLG_COMP2: 4,
      // Bit 2, compression option
      FLG_DESC: 8,
      // Bit 3, data descriptor
      FLG_ENH: 16,
      // Bit 4, enhanced deflating
      FLG_PATCH: 32,
      // Bit 5, indicates that the file is compressed patched data.
      FLG_STR: 64,
      // Bit 6, strong encryption (patented)
      // Bits 7-10: Currently unused.
      FLG_EFS: 2048,
      // Bit 11: Language encoding flag (EFS)
      // Bit 12: Reserved by PKWARE for enhanced compression.
      // Bit 13: encrypted the Central Directory (patented).
      // Bits 14-15: Reserved by PKWARE.
      FLG_MSK: 4096,
      // mask header values
      /* Load type */
      FILE: 2,
      BUFFER: 1,
      NONE: 0,
      /* 4.5 Extensible data fields */
      EF_ID: 0,
      EF_SIZE: 2,
      /* Header IDs */
      ID_ZIP64: 1,
      ID_AVINFO: 7,
      ID_PFS: 8,
      ID_OS2: 9,
      ID_NTFS: 10,
      ID_OPENVMS: 12,
      ID_UNIX: 13,
      ID_FORK: 14,
      ID_PATCH: 15,
      ID_X509_PKCS7: 20,
      ID_X509_CERTID_F: 21,
      ID_X509_CERTID_C: 22,
      ID_STRONGENC: 23,
      ID_RECORD_MGT: 24,
      ID_X509_PKCS7_RL: 25,
      ID_IBM1: 101,
      ID_IBM2: 102,
      ID_POSZIP: 18064,
      EF_ZIP64_OR_32: 4294967295,
      EF_ZIP64_OR_16: 65535,
      EF_ZIP64_SUNCOMP: 0,
      EF_ZIP64_SCOMP: 8,
      EF_ZIP64_RHO: 16,
      EF_ZIP64_DSN: 24
    };
  }
});

// ../../../adm-zip/util/errors.js
var require_errors = __commonJS({
  "../../../adm-zip/util/errors.js"(exports2) {
    var errors = {
      /* Header error messages */
      INVALID_LOC: "Invalid LOC header (bad signature)",
      INVALID_CEN: "Invalid CEN header (bad signature)",
      INVALID_END: "Invalid END header (bad signature)",
      /* Descriptor */
      DESCRIPTOR_NOT_EXIST: "No descriptor present",
      DESCRIPTOR_UNKNOWN: "Unknown descriptor format",
      DESCRIPTOR_FAULTY: "Descriptor data is malformed",
      /* ZipEntry error messages*/
      NO_DATA: "Nothing to decompress",
      BAD_CRC: "CRC32 checksum failed {0}",
      FILE_IN_THE_WAY: "There is a file in the way: {0}",
      UNKNOWN_METHOD: "Invalid/unsupported compression method",
      /* Inflater error messages */
      AVAIL_DATA: "inflate::Available inflate data did not terminate",
      INVALID_DISTANCE: "inflate::Invalid literal/length or distance code in fixed or dynamic block",
      TO_MANY_CODES: "inflate::Dynamic block code description: too many length or distance codes",
      INVALID_REPEAT_LEN: "inflate::Dynamic block code description: repeat more than specified lengths",
      INVALID_REPEAT_FIRST: "inflate::Dynamic block code description: repeat lengths with no first length",
      INCOMPLETE_CODES: "inflate::Dynamic block code description: code lengths codes incomplete",
      INVALID_DYN_DISTANCE: "inflate::Dynamic block code description: invalid distance code lengths",
      INVALID_CODES_LEN: "inflate::Dynamic block code description: invalid literal/length code lengths",
      INVALID_STORE_BLOCK: "inflate::Stored block length did not match one's complement",
      INVALID_BLOCK_TYPE: "inflate::Invalid block type (type == 3)",
      /* ADM-ZIP error messages */
      CANT_EXTRACT_FILE: "Could not extract the file",
      CANT_OVERRIDE: "Target file already exists",
      DISK_ENTRY_TOO_LARGE: "Number of disk entries is too large",
      NO_ZIP: "No zip file was loaded",
      NO_ENTRY: "Entry doesn't exist",
      DIRECTORY_CONTENT_ERROR: "A directory cannot have content",
      FILE_NOT_FOUND: 'File not found: "{0}"',
      NOT_IMPLEMENTED: "Not implemented",
      INVALID_FILENAME: "Invalid filename",
      INVALID_FORMAT: "Invalid or unsupported zip format. No END header found",
      INVALID_PASS_PARAM: "Incompatible password parameter",
      WRONG_PASSWORD: "Wrong Password",
      /* ADM-ZIP */
      COMMENT_TOO_LONG: "Comment is too long",
      // Comment can be max 65535 bytes long (NOTE: some non-US characters may take more space)
      EXTRA_FIELD_PARSE_ERROR: "Extra field parsing error"
    };
    function E(message) {
      return function(...args) {
        if (args.length) {
          message = message.replace(/\{(\d)\}/g, (_, n) => args[n] || "");
        }
        return new Error("ADM-ZIP: " + message);
      };
    }
    for (const msg of Object.keys(errors)) {
      exports2[msg] = E(errors[msg]);
    }
  }
});

// ../../../adm-zip/util/utils.js
var require_utils = __commonJS({
  "../../../adm-zip/util/utils.js"(exports2, module2) {
    var fsystem = require("fs");
    var pth = require("path");
    var Constants = require_constants();
    var Errors = require_errors();
    var isWin = typeof process === "object" && "win32" === process.platform;
    var is_Obj = (obj) => typeof obj === "object" && obj !== null;
    var crcTable = new Uint32Array(256).map((t, c) => {
      for (let k = 0; k < 8; k++) {
        if ((c & 1) !== 0) {
          c = 3988292384 ^ c >>> 1;
        } else {
          c >>>= 1;
        }
      }
      return c >>> 0;
    });
    function Utils(opts) {
      this.sep = pth.sep;
      this.fs = fsystem;
      if (is_Obj(opts)) {
        if (is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
          this.fs = opts.fs;
        }
      }
    }
    module2.exports = Utils;
    Utils.prototype.makeDir = function(folder) {
      const self = this;
      function mkdirSync(fpath) {
        let resolvedPath = fpath.split(self.sep)[0];
        fpath.split(self.sep).forEach(function(name) {
          if (!name || name.substr(-1, 1) === ":") return;
          resolvedPath += self.sep + name;
          var stat;
          try {
            stat = self.fs.statSync(resolvedPath);
          } catch (e) {
            self.fs.mkdirSync(resolvedPath);
          }
          if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY(`"${resolvedPath}"`);
        });
      }
      mkdirSync(folder);
    };
    Utils.prototype.writeFileTo = function(path6, content, overwrite, attr) {
      const self = this;
      if (self.fs.existsSync(path6)) {
        if (!overwrite) return false;
        var stat = self.fs.statSync(path6);
        if (stat.isDirectory()) {
          return false;
        }
      }
      var folder = pth.dirname(path6);
      if (!self.fs.existsSync(folder)) {
        self.makeDir(folder);
      }
      var fd;
      try {
        fd = self.fs.openSync(path6, "w", 438);
      } catch (e) {
        self.fs.chmodSync(path6, 438);
        fd = self.fs.openSync(path6, "w", 438);
      }
      if (fd) {
        try {
          self.fs.writeSync(fd, content, 0, content.length, 0);
        } finally {
          self.fs.closeSync(fd);
        }
      }
      self.fs.chmodSync(path6, attr || 438);
      return true;
    };
    Utils.prototype.writeFileToAsync = function(path6, content, overwrite, attr, callback) {
      if (typeof attr === "function") {
        callback = attr;
        attr = void 0;
      }
      const self = this;
      self.fs.exists(path6, function(exist) {
        if (exist && !overwrite) return callback(false);
        self.fs.stat(path6, function(err, stat) {
          if (exist && stat.isDirectory()) {
            return callback(false);
          }
          var folder = pth.dirname(path6);
          self.fs.exists(folder, function(exists) {
            if (!exists) self.makeDir(folder);
            self.fs.open(path6, "w", 438, function(err2, fd) {
              if (err2) {
                self.fs.chmod(path6, 438, function() {
                  self.fs.open(path6, "w", 438, function(err3, fd2) {
                    self.fs.write(fd2, content, 0, content.length, 0, function() {
                      self.fs.close(fd2, function() {
                        self.fs.chmod(path6, attr || 438, function() {
                          callback(true);
                        });
                      });
                    });
                  });
                });
              } else if (fd) {
                self.fs.write(fd, content, 0, content.length, 0, function() {
                  self.fs.close(fd, function() {
                    self.fs.chmod(path6, attr || 438, function() {
                      callback(true);
                    });
                  });
                });
              } else {
                self.fs.chmod(path6, attr || 438, function() {
                  callback(true);
                });
              }
            });
          });
        });
      });
    };
    Utils.prototype.findFiles = function(path6) {
      const self = this;
      function findSync(dir, pattern, recursive) {
        if (typeof pattern === "boolean") {
          recursive = pattern;
          pattern = void 0;
        }
        let files = [];
        self.fs.readdirSync(dir).forEach(function(file) {
          const path7 = pth.join(dir, file);
          const stat = self.fs.statSync(path7);
          if (!pattern || pattern.test(path7)) {
            files.push(pth.normalize(path7) + (stat.isDirectory() ? self.sep : ""));
          }
          if (stat.isDirectory() && recursive) files = files.concat(findSync(path7, pattern, recursive));
        });
        return files;
      }
      return findSync(path6, void 0, true);
    };
    Utils.prototype.findFilesAsync = function(dir, cb) {
      const self = this;
      let results = [];
      self.fs.readdir(dir, function(err, list) {
        if (err) return cb(err);
        let list_length = list.length;
        if (!list_length) return cb(null, results);
        list.forEach(function(file) {
          file = pth.join(dir, file);
          self.fs.stat(file, function(err2, stat) {
            if (err2) return cb(err2);
            if (stat) {
              results.push(pth.normalize(file) + (stat.isDirectory() ? self.sep : ""));
              if (stat.isDirectory()) {
                self.findFilesAsync(file, function(err3, res) {
                  if (err3) return cb(err3);
                  results = results.concat(res);
                  if (!--list_length) cb(null, results);
                });
              } else {
                if (!--list_length) cb(null, results);
              }
            }
          });
        });
      });
    };
    Utils.prototype.getAttributes = function() {
    };
    Utils.prototype.setAttributes = function() {
    };
    Utils.crc32update = function(crc, byte) {
      return crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    };
    Utils.crc32 = function(buf) {
      if (typeof buf === "string") {
        buf = Buffer.from(buf, "utf8");
      }
      let len = buf.length;
      let crc = ~0;
      for (let off = 0; off < len; ) crc = Utils.crc32update(crc, buf[off++]);
      return ~crc >>> 0;
    };
    Utils.methodToString = function(method) {
      switch (method) {
        case Constants.STORED:
          return "STORED (" + method + ")";
        case Constants.DEFLATED:
          return "DEFLATED (" + method + ")";
        default:
          return "UNSUPPORTED (" + method + ")";
      }
    };
    Utils.canonical = function(path6) {
      if (!path6) return "";
      const safeSuffix = pth.posix.normalize("/" + path6.split("\\").join("/"));
      return pth.join(".", safeSuffix);
    };
    Utils.zipnamefix = function(path6) {
      if (!path6) return "";
      const safeSuffix = pth.posix.normalize("/" + path6.split("\\").join("/"));
      return pth.posix.join(".", safeSuffix);
    };
    Utils.findLast = function(arr, callback) {
      if (!Array.isArray(arr)) throw new TypeError("arr is not array");
      const len = arr.length >>> 0;
      for (let i = len - 1; i >= 0; i--) {
        if (callback(arr[i], i, arr)) {
          return arr[i];
        }
      }
      return void 0;
    };
    Utils.sanitize = function(prefix, name) {
      prefix = pth.resolve(pth.normalize(prefix));
      var parts = name.split("/");
      for (var i = 0, l = parts.length; i < l; i++) {
        var path6 = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
        if (path6.indexOf(prefix) === 0) {
          return path6;
        }
      }
      return pth.normalize(pth.join(prefix, pth.basename(name)));
    };
    Utils.toBuffer = function toBuffer(input, encoder) {
      if (Buffer.isBuffer(input)) {
        return input;
      } else if (input instanceof Uint8Array) {
        return Buffer.from(input);
      } else {
        return typeof input === "string" ? encoder(input) : Buffer.alloc(0);
      }
    };
    Utils.readBigUInt64LE = function(buffer, index) {
      var slice = Buffer.from(buffer.slice(index, index + 8));
      slice.swap64();
      return parseInt(`0x${slice.toString("hex")}`);
    };
    Utils.fromDOS2Date = function(val) {
      return new Date((val >> 25 & 127) + 1980, Math.max((val >> 21 & 15) - 1, 0), Math.max(val >> 16 & 31, 1), val >> 11 & 31, val >> 5 & 63, (val & 31) << 1);
    };
    Utils.fromDate2DOS = function(val) {
      let date = 0;
      let time = 0;
      if (val.getFullYear() > 1979) {
        date = (val.getFullYear() - 1980 & 127) << 9 | val.getMonth() + 1 << 5 | val.getDate();
        time = val.getHours() << 11 | val.getMinutes() << 5 | val.getSeconds() >> 1;
      }
      return date << 16 | time;
    };
    Utils.isWin = isWin;
    Utils.crcTable = crcTable;
  }
});

// ../../../adm-zip/util/fattr.js
var require_fattr = __commonJS({
  "../../../adm-zip/util/fattr.js"(exports2, module2) {
    var pth = require("path");
    module2.exports = function(path6, { fs: fs4 }) {
      var _path = path6 || "", _obj = newAttr(), _stat = null;
      function newAttr() {
        return {
          directory: false,
          readonly: false,
          hidden: false,
          executable: false,
          mtime: 0,
          atime: 0
        };
      }
      if (_path && fs4.existsSync(_path)) {
        _stat = fs4.statSync(_path);
        _obj.directory = _stat.isDirectory();
        _obj.mtime = _stat.mtime;
        _obj.atime = _stat.atime;
        _obj.executable = (73 & _stat.mode) !== 0;
        _obj.readonly = (128 & _stat.mode) === 0;
        _obj.hidden = pth.basename(_path)[0] === ".";
      } else {
        console.warn("Invalid path: " + _path);
      }
      return {
        get directory() {
          return _obj.directory;
        },
        get readOnly() {
          return _obj.readonly;
        },
        get hidden() {
          return _obj.hidden;
        },
        get mtime() {
          return _obj.mtime;
        },
        get atime() {
          return _obj.atime;
        },
        get executable() {
          return _obj.executable;
        },
        decodeAttributes: function() {
        },
        encodeAttributes: function() {
        },
        toJSON: function() {
          return {
            path: _path,
            isDirectory: _obj.directory,
            isReadOnly: _obj.readonly,
            isHidden: _obj.hidden,
            isExecutable: _obj.executable,
            mTime: _obj.mtime,
            aTime: _obj.atime
          };
        },
        toString: function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }
      };
    };
  }
});

// ../../../adm-zip/util/decoder.js
var require_decoder = __commonJS({
  "../../../adm-zip/util/decoder.js"(exports2, module2) {
    module2.exports = {
      efs: true,
      encode: (data) => Buffer.from(data, "utf8"),
      decode: (data) => data.toString("utf8")
    };
  }
});

// ../../../adm-zip/util/index.js
var require_util = __commonJS({
  "../../../adm-zip/util/index.js"(exports2, module2) {
    module2.exports = require_utils();
    module2.exports.Constants = require_constants();
    module2.exports.Errors = require_errors();
    module2.exports.FileAttr = require_fattr();
    module2.exports.decoder = require_decoder();
  }
});

// ../../../adm-zip/headers/entryHeader.js
var require_entryHeader = __commonJS({
  "../../../adm-zip/headers/entryHeader.js"(exports2, module2) {
    var Utils = require_util();
    var Constants = Utils.Constants;
    module2.exports = function() {
      var _verMade = 20, _version = 10, _flags = 0, _method = 0, _time = 0, _crc = 0, _compressedSize = 0, _size = 0, _fnameLen = 0, _extraLen = 0, _comLen = 0, _diskStart = 0, _inattr = 0, _attr = 0, _offset = 0;
      _verMade |= Utils.isWin ? 2560 : 768;
      _flags |= Constants.FLG_EFS;
      const _localHeader = {
        extraLen: 0
      };
      const uint32 = (val) => Math.max(0, val) >>> 0;
      const uint16 = (val) => Math.max(0, val) & 65535;
      const uint8 = (val) => Math.max(0, val) & 255;
      _time = Utils.fromDate2DOS(/* @__PURE__ */ new Date());
      return {
        get made() {
          return _verMade;
        },
        set made(val) {
          _verMade = val;
        },
        get version() {
          return _version;
        },
        set version(val) {
          _version = val;
        },
        get flags() {
          return _flags;
        },
        set flags(val) {
          _flags = val;
        },
        get flags_efs() {
          return (_flags & Constants.FLG_EFS) > 0;
        },
        set flags_efs(val) {
          if (val) {
            _flags |= Constants.FLG_EFS;
          } else {
            _flags &= ~Constants.FLG_EFS;
          }
        },
        get flags_desc() {
          return (_flags & Constants.FLG_DESC) > 0;
        },
        set flags_desc(val) {
          if (val) {
            _flags |= Constants.FLG_DESC;
          } else {
            _flags &= ~Constants.FLG_DESC;
          }
        },
        get method() {
          return _method;
        },
        set method(val) {
          switch (val) {
            case Constants.STORED:
              this.version = 10;
            case Constants.DEFLATED:
            default:
              this.version = 20;
          }
          _method = val;
        },
        get time() {
          return Utils.fromDOS2Date(this.timeval);
        },
        set time(val) {
          this.timeval = Utils.fromDate2DOS(val);
        },
        get timeval() {
          return _time;
        },
        set timeval(val) {
          _time = uint32(val);
        },
        get timeHighByte() {
          return uint8(_time >>> 8);
        },
        get crc() {
          return _crc;
        },
        set crc(val) {
          _crc = uint32(val);
        },
        get compressedSize() {
          return _compressedSize;
        },
        set compressedSize(val) {
          _compressedSize = uint32(val);
        },
        get size() {
          return _size;
        },
        set size(val) {
          _size = uint32(val);
        },
        get fileNameLength() {
          return _fnameLen;
        },
        set fileNameLength(val) {
          _fnameLen = val;
        },
        get extraLength() {
          return _extraLen;
        },
        set extraLength(val) {
          _extraLen = val;
        },
        get extraLocalLength() {
          return _localHeader.extraLen;
        },
        set extraLocalLength(val) {
          _localHeader.extraLen = val;
        },
        get commentLength() {
          return _comLen;
        },
        set commentLength(val) {
          _comLen = val;
        },
        get diskNumStart() {
          return _diskStart;
        },
        set diskNumStart(val) {
          _diskStart = uint32(val);
        },
        get inAttr() {
          return _inattr;
        },
        set inAttr(val) {
          _inattr = uint32(val);
        },
        get attr() {
          return _attr;
        },
        set attr(val) {
          _attr = uint32(val);
        },
        // get Unix file permissions
        get fileAttr() {
          return (_attr || 0) >> 16 & 4095;
        },
        get offset() {
          return _offset;
        },
        set offset(val) {
          _offset = uint32(val);
        },
        get encrypted() {
          return (_flags & Constants.FLG_ENC) === Constants.FLG_ENC;
        },
        get centralHeaderSize() {
          return Constants.CENHDR + _fnameLen + _extraLen + _comLen;
        },
        get realDataOffset() {
          return _offset + Constants.LOCHDR + _localHeader.fnameLen + _localHeader.extraLen;
        },
        get localHeader() {
          return _localHeader;
        },
        loadLocalHeaderFromBinary: function(input) {
          var data = input.slice(_offset, _offset + Constants.LOCHDR);
          if (data.readUInt32LE(0) !== Constants.LOCSIG) {
            throw Utils.Errors.INVALID_LOC();
          }
          _localHeader.version = data.readUInt16LE(Constants.LOCVER);
          _localHeader.flags = data.readUInt16LE(Constants.LOCFLG);
          _localHeader.method = data.readUInt16LE(Constants.LOCHOW);
          _localHeader.time = data.readUInt32LE(Constants.LOCTIM);
          _localHeader.crc = data.readUInt32LE(Constants.LOCCRC);
          _localHeader.compressedSize = data.readUInt32LE(Constants.LOCSIZ);
          _localHeader.size = data.readUInt32LE(Constants.LOCLEN);
          _localHeader.fnameLen = data.readUInt16LE(Constants.LOCNAM);
          _localHeader.extraLen = data.readUInt16LE(Constants.LOCEXT);
          const extraStart = _offset + Constants.LOCHDR + _localHeader.fnameLen;
          const extraEnd = extraStart + _localHeader.extraLen;
          return input.slice(extraStart, extraEnd);
        },
        loadFromBinary: function(data) {
          if (data.length !== Constants.CENHDR || data.readUInt32LE(0) !== Constants.CENSIG) {
            throw Utils.Errors.INVALID_CEN();
          }
          _verMade = data.readUInt16LE(Constants.CENVEM);
          _version = data.readUInt16LE(Constants.CENVER);
          _flags = data.readUInt16LE(Constants.CENFLG);
          _method = data.readUInt16LE(Constants.CENHOW);
          _time = data.readUInt32LE(Constants.CENTIM);
          _crc = data.readUInt32LE(Constants.CENCRC);
          _compressedSize = data.readUInt32LE(Constants.CENSIZ);
          _size = data.readUInt32LE(Constants.CENLEN);
          _fnameLen = data.readUInt16LE(Constants.CENNAM);
          _extraLen = data.readUInt16LE(Constants.CENEXT);
          _comLen = data.readUInt16LE(Constants.CENCOM);
          _diskStart = data.readUInt16LE(Constants.CENDSK);
          _inattr = data.readUInt16LE(Constants.CENATT);
          _attr = data.readUInt32LE(Constants.CENATX);
          _offset = data.readUInt32LE(Constants.CENOFF);
        },
        localHeaderToBinary: function() {
          var data = Buffer.alloc(Constants.LOCHDR);
          data.writeUInt32LE(Constants.LOCSIG, 0);
          data.writeUInt16LE(_version, Constants.LOCVER);
          data.writeUInt16LE(_flags, Constants.LOCFLG);
          data.writeUInt16LE(_method, Constants.LOCHOW);
          data.writeUInt32LE(_time, Constants.LOCTIM);
          data.writeUInt32LE(_crc, Constants.LOCCRC);
          data.writeUInt32LE(_compressedSize, Constants.LOCSIZ);
          data.writeUInt32LE(_size, Constants.LOCLEN);
          data.writeUInt16LE(_fnameLen, Constants.LOCNAM);
          data.writeUInt16LE(_localHeader.extraLen, Constants.LOCEXT);
          return data;
        },
        centralHeaderToBinary: function() {
          var data = Buffer.alloc(Constants.CENHDR + _fnameLen + _extraLen + _comLen);
          data.writeUInt32LE(Constants.CENSIG, 0);
          data.writeUInt16LE(_verMade, Constants.CENVEM);
          data.writeUInt16LE(_version, Constants.CENVER);
          data.writeUInt16LE(_flags, Constants.CENFLG);
          data.writeUInt16LE(_method, Constants.CENHOW);
          data.writeUInt32LE(_time, Constants.CENTIM);
          data.writeUInt32LE(_crc, Constants.CENCRC);
          data.writeUInt32LE(_compressedSize, Constants.CENSIZ);
          data.writeUInt32LE(_size, Constants.CENLEN);
          data.writeUInt16LE(_fnameLen, Constants.CENNAM);
          data.writeUInt16LE(_extraLen, Constants.CENEXT);
          data.writeUInt16LE(_comLen, Constants.CENCOM);
          data.writeUInt16LE(_diskStart, Constants.CENDSK);
          data.writeUInt16LE(_inattr, Constants.CENATT);
          data.writeUInt32LE(_attr, Constants.CENATX);
          data.writeUInt32LE(_offset, Constants.CENOFF);
          return data;
        },
        toJSON: function() {
          const bytes = function(nr) {
            return nr + " bytes";
          };
          return {
            made: _verMade,
            version: _version,
            flags: _flags,
            method: Utils.methodToString(_method),
            time: this.time,
            crc: "0x" + _crc.toString(16).toUpperCase(),
            compressedSize: bytes(_compressedSize),
            size: bytes(_size),
            fileNameLength: bytes(_fnameLen),
            extraLength: bytes(_extraLen),
            commentLength: bytes(_comLen),
            diskNumStart: _diskStart,
            inAttr: _inattr,
            attr: _attr,
            offset: _offset,
            centralHeaderSize: bytes(Constants.CENHDR + _fnameLen + _extraLen + _comLen)
          };
        },
        toString: function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }
      };
    };
  }
});

// ../../../adm-zip/headers/mainHeader.js
var require_mainHeader = __commonJS({
  "../../../adm-zip/headers/mainHeader.js"(exports2, module2) {
    var Utils = require_util();
    var Constants = Utils.Constants;
    module2.exports = function() {
      var _volumeEntries = 0, _totalEntries = 0, _size = 0, _offset = 0, _commentLength = 0;
      return {
        get diskEntries() {
          return _volumeEntries;
        },
        set diskEntries(val) {
          _volumeEntries = _totalEntries = val;
        },
        get totalEntries() {
          return _totalEntries;
        },
        set totalEntries(val) {
          _totalEntries = _volumeEntries = val;
        },
        get size() {
          return _size;
        },
        set size(val) {
          _size = val;
        },
        get offset() {
          return _offset;
        },
        set offset(val) {
          _offset = val;
        },
        get commentLength() {
          return _commentLength;
        },
        set commentLength(val) {
          _commentLength = val;
        },
        get mainHeaderSize() {
          return Constants.ENDHDR + _commentLength;
        },
        loadFromBinary: function(data) {
          if ((data.length !== Constants.ENDHDR || data.readUInt32LE(0) !== Constants.ENDSIG) && (data.length < Constants.ZIP64HDR || data.readUInt32LE(0) !== Constants.ZIP64SIG)) {
            throw Utils.Errors.INVALID_END();
          }
          if (data.readUInt32LE(0) === Constants.ENDSIG) {
            _volumeEntries = data.readUInt16LE(Constants.ENDSUB);
            _totalEntries = data.readUInt16LE(Constants.ENDTOT);
            _size = data.readUInt32LE(Constants.ENDSIZ);
            _offset = data.readUInt32LE(Constants.ENDOFF);
            _commentLength = data.readUInt16LE(Constants.ENDCOM);
          } else {
            _volumeEntries = Utils.readBigUInt64LE(data, Constants.ZIP64SUB);
            _totalEntries = Utils.readBigUInt64LE(data, Constants.ZIP64TOT);
            _size = Utils.readBigUInt64LE(data, Constants.ZIP64SIZE);
            _offset = Utils.readBigUInt64LE(data, Constants.ZIP64OFF);
            _commentLength = 0;
          }
        },
        toBinary: function() {
          var b = Buffer.alloc(Constants.ENDHDR + _commentLength);
          b.writeUInt32LE(Constants.ENDSIG, 0);
          b.writeUInt32LE(0, 4);
          b.writeUInt16LE(_volumeEntries, Constants.ENDSUB);
          b.writeUInt16LE(_totalEntries, Constants.ENDTOT);
          b.writeUInt32LE(_size, Constants.ENDSIZ);
          b.writeUInt32LE(_offset, Constants.ENDOFF);
          b.writeUInt16LE(_commentLength, Constants.ENDCOM);
          b.fill(" ", Constants.ENDHDR);
          return b;
        },
        toJSON: function() {
          const offset = function(nr, len) {
            let offs = nr.toString(16).toUpperCase();
            while (offs.length < len) offs = "0" + offs;
            return "0x" + offs;
          };
          return {
            diskEntries: _volumeEntries,
            totalEntries: _totalEntries,
            size: _size + " bytes",
            offset: offset(_offset, 4),
            commentLength: _commentLength
          };
        },
        toString: function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }
      };
    };
  }
});

// ../../../adm-zip/headers/index.js
var require_headers = __commonJS({
  "../../../adm-zip/headers/index.js"(exports2) {
    exports2.EntryHeader = require_entryHeader();
    exports2.MainHeader = require_mainHeader();
  }
});

// ../../../adm-zip/methods/deflater.js
var require_deflater = __commonJS({
  "../../../adm-zip/methods/deflater.js"(exports2, module2) {
    module2.exports = function(inbuf) {
      var zlib = require("zlib");
      var opts = { chunkSize: (parseInt(inbuf.length / 1024) + 1) * 1024 };
      return {
        deflate: function() {
          return zlib.deflateRawSync(inbuf, opts);
        },
        deflateAsync: function(callback) {
          var tmp = zlib.createDeflateRaw(opts), parts = [], total = 0;
          tmp.on("data", function(data) {
            parts.push(data);
            total += data.length;
          });
          tmp.on("end", function() {
            var buf = Buffer.alloc(total), written = 0;
            buf.fill(0);
            for (var i = 0; i < parts.length; i++) {
              var part = parts[i];
              part.copy(buf, written);
              written += part.length;
            }
            callback && callback(buf);
          });
          tmp.end(inbuf);
        }
      };
    };
  }
});

// ../../../adm-zip/methods/inflater.js
var require_inflater = __commonJS({
  "../../../adm-zip/methods/inflater.js"(exports2, module2) {
    var version = +(process.versions ? process.versions.node : "").split(".")[0] || 0;
    module2.exports = function(inbuf, expectedLength) {
      var zlib = require("zlib");
      const option = version >= 15 && expectedLength > 0 ? { maxOutputLength: expectedLength } : {};
      return {
        inflate: function() {
          return zlib.inflateRawSync(inbuf, option);
        },
        inflateAsync: function(callback) {
          var tmp = zlib.createInflateRaw(option), parts = [], total = 0;
          tmp.on("data", function(data) {
            parts.push(data);
            total += data.length;
          });
          tmp.on("end", function() {
            var buf = Buffer.alloc(total), written = 0;
            buf.fill(0);
            for (var i = 0; i < parts.length; i++) {
              var part = parts[i];
              part.copy(buf, written);
              written += part.length;
            }
            callback && callback(buf);
          });
          tmp.end(inbuf);
        }
      };
    };
  }
});

// ../../../adm-zip/methods/zipcrypto.js
var require_zipcrypto = __commonJS({
  "../../../adm-zip/methods/zipcrypto.js"(exports2, module2) {
    "use strict";
    var { randomFillSync } = require("crypto");
    var Errors = require_errors();
    var crctable = new Uint32Array(256).map((t, crc) => {
      for (let j = 0; j < 8; j++) {
        if (0 !== (crc & 1)) {
          crc = crc >>> 1 ^ 3988292384;
        } else {
          crc >>>= 1;
        }
      }
      return crc >>> 0;
    });
    var uMul = (a, b) => Math.imul(a, b) >>> 0;
    var crc32update = (pCrc32, bval) => {
      return crctable[(pCrc32 ^ bval) & 255] ^ pCrc32 >>> 8;
    };
    var genSalt = () => {
      if ("function" === typeof randomFillSync) {
        return randomFillSync(Buffer.alloc(12));
      } else {
        return genSalt.node();
      }
    };
    genSalt.node = () => {
      const salt = Buffer.alloc(12);
      const len = salt.length;
      for (let i = 0; i < len; i++) salt[i] = Math.random() * 256 & 255;
      return salt;
    };
    var config = {
      genSalt
    };
    function Initkeys(pw) {
      const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
      this.keys = new Uint32Array([305419896, 591751049, 878082192]);
      for (let i = 0; i < pass.length; i++) {
        this.updateKeys(pass[i]);
      }
    }
    Initkeys.prototype.updateKeys = function(byteValue) {
      const keys = this.keys;
      keys[0] = crc32update(keys[0], byteValue);
      keys[1] += keys[0] & 255;
      keys[1] = uMul(keys[1], 134775813) + 1;
      keys[2] = crc32update(keys[2], keys[1] >>> 24);
      return byteValue;
    };
    Initkeys.prototype.next = function() {
      const k = (this.keys[2] | 2) >>> 0;
      return uMul(k, k ^ 1) >> 8 & 255;
    };
    function make_decrypter(pwd) {
      const keys = new Initkeys(pwd);
      return function(data) {
        const result = Buffer.alloc(data.length);
        let pos = 0;
        for (let c of data) {
          result[pos++] = keys.updateKeys(c ^ keys.next());
        }
        return result;
      };
    }
    function make_encrypter(pwd) {
      const keys = new Initkeys(pwd);
      return function(data, result, pos = 0) {
        if (!result) result = Buffer.alloc(data.length);
        for (let c of data) {
          const k = keys.next();
          result[pos++] = c ^ k;
          keys.updateKeys(c);
        }
        return result;
      };
    }
    function decrypt(data, header, pwd) {
      if (!data || !Buffer.isBuffer(data) || data.length < 12) {
        return Buffer.alloc(0);
      }
      const decrypter = make_decrypter(pwd);
      const salt = decrypter(data.slice(0, 12));
      const verifyByte = (header.flags & 8) === 8 ? header.timeHighByte : header.crc >>> 24;
      if (salt[11] !== verifyByte) {
        throw Errors.WRONG_PASSWORD();
      }
      return decrypter(data.slice(12));
    }
    function _salter(data) {
      if (Buffer.isBuffer(data) && data.length >= 12) {
        config.genSalt = function() {
          return data.slice(0, 12);
        };
      } else if (data === "node") {
        config.genSalt = genSalt.node;
      } else {
        config.genSalt = genSalt;
      }
    }
    function encrypt(data, header, pwd, oldlike = false) {
      if (data == null) data = Buffer.alloc(0);
      if (!Buffer.isBuffer(data)) data = Buffer.from(data.toString());
      const encrypter = make_encrypter(pwd);
      const salt = config.genSalt();
      salt[11] = header.crc >>> 24 & 255;
      if (oldlike) salt[10] = header.crc >>> 16 & 255;
      const result = Buffer.alloc(data.length + 12);
      encrypter(salt, result);
      return encrypter(data, result, 12);
    }
    module2.exports = { decrypt, encrypt, _salter };
  }
});

// ../../../adm-zip/methods/index.js
var require_methods = __commonJS({
  "../../../adm-zip/methods/index.js"(exports2) {
    exports2.Deflater = require_deflater();
    exports2.Inflater = require_inflater();
    exports2.ZipCrypto = require_zipcrypto();
  }
});

// ../../../adm-zip/zipEntry.js
var require_zipEntry = __commonJS({
  "../../../adm-zip/zipEntry.js"(exports2, module2) {
    var Utils = require_util();
    var Headers = require_headers();
    var Constants = Utils.Constants;
    var Methods = require_methods();
    module2.exports = function(options, input) {
      var _centralHeader = new Headers.EntryHeader(), _entryName = Buffer.alloc(0), _comment = Buffer.alloc(0), _isDirectory = false, uncompressedData = null, _extra = Buffer.alloc(0), _extralocal = Buffer.alloc(0), _efs = true;
      const opts = options;
      const decoder = typeof opts.decoder === "object" ? opts.decoder : Utils.decoder;
      _efs = decoder.hasOwnProperty("efs") ? decoder.efs : false;
      function getCompressedDataFromZip() {
        if (!input || !(input instanceof Uint8Array)) {
          return Buffer.alloc(0);
        }
        _extralocal = _centralHeader.loadLocalHeaderFromBinary(input);
        return input.slice(_centralHeader.realDataOffset, _centralHeader.realDataOffset + _centralHeader.compressedSize);
      }
      function crc32OK(data) {
        if (!_centralHeader.flags_desc) {
          if (Utils.crc32(data) !== _centralHeader.localHeader.crc) {
            return false;
          }
        } else {
          const descriptor = {};
          const dataEndOffset = _centralHeader.realDataOffset + _centralHeader.compressedSize;
          if (input.readUInt32LE(dataEndOffset) == Constants.LOCSIG || input.readUInt32LE(dataEndOffset) == Constants.CENSIG) {
            throw Utils.Errors.DESCRIPTOR_NOT_EXIST();
          }
          if (input.readUInt32LE(dataEndOffset) == Constants.EXTSIG) {
            descriptor.crc = input.readUInt32LE(dataEndOffset + Constants.EXTCRC);
            descriptor.compressedSize = input.readUInt32LE(dataEndOffset + Constants.EXTSIZ);
            descriptor.size = input.readUInt32LE(dataEndOffset + Constants.EXTLEN);
          } else if (input.readUInt16LE(dataEndOffset + 12) === 19280) {
            descriptor.crc = input.readUInt32LE(dataEndOffset + Constants.EXTCRC - 4);
            descriptor.compressedSize = input.readUInt32LE(dataEndOffset + Constants.EXTSIZ - 4);
            descriptor.size = input.readUInt32LE(dataEndOffset + Constants.EXTLEN - 4);
          } else {
            throw Utils.Errors.DESCRIPTOR_UNKNOWN();
          }
          if (descriptor.compressedSize !== _centralHeader.compressedSize || descriptor.size !== _centralHeader.size || descriptor.crc !== _centralHeader.crc) {
            throw Utils.Errors.DESCRIPTOR_FAULTY();
          }
          if (Utils.crc32(data) !== descriptor.crc) {
            return false;
          }
        }
        return true;
      }
      function decompress(async, callback, pass) {
        if (typeof callback === "undefined" && typeof async === "string") {
          pass = async;
          async = void 0;
        }
        if (_isDirectory) {
          if (async && callback) {
            callback(Buffer.alloc(0), Utils.Errors.DIRECTORY_CONTENT_ERROR());
          }
          return Buffer.alloc(0);
        }
        var compressedData = getCompressedDataFromZip();
        if (compressedData.length === 0) {
          if (async && callback) callback(compressedData);
          return compressedData;
        }
        if (_centralHeader.encrypted) {
          if ("string" !== typeof pass && !Buffer.isBuffer(pass)) {
            throw Utils.Errors.INVALID_PASS_PARAM();
          }
          compressedData = Methods.ZipCrypto.decrypt(compressedData, _centralHeader, pass);
        }
        var data = Buffer.alloc(_centralHeader.size);
        switch (_centralHeader.method) {
          case Utils.Constants.STORED:
            compressedData.copy(data);
            if (!crc32OK(data)) {
              if (async && callback) callback(data, Utils.Errors.BAD_CRC());
              throw Utils.Errors.BAD_CRC();
            } else {
              if (async && callback) callback(data);
              return data;
            }
          case Utils.Constants.DEFLATED:
            var inflater = new Methods.Inflater(compressedData, _centralHeader.size);
            if (!async) {
              const result = inflater.inflate(data);
              result.copy(data, 0);
              if (!crc32OK(data)) {
                throw Utils.Errors.BAD_CRC(`"${decoder.decode(_entryName)}"`);
              }
              return data;
            } else {
              inflater.inflateAsync(function(result) {
                result.copy(result, 0);
                if (callback) {
                  if (!crc32OK(result)) {
                    callback(result, Utils.Errors.BAD_CRC());
                  } else {
                    callback(result);
                  }
                }
              });
            }
            break;
          default:
            if (async && callback) callback(Buffer.alloc(0), Utils.Errors.UNKNOWN_METHOD());
            throw Utils.Errors.UNKNOWN_METHOD();
        }
      }
      function compress(async, callback) {
        if ((!uncompressedData || !uncompressedData.length) && Buffer.isBuffer(input)) {
          if (async && callback) callback(getCompressedDataFromZip());
          return getCompressedDataFromZip();
        }
        if (uncompressedData.length && !_isDirectory) {
          var compressedData;
          switch (_centralHeader.method) {
            case Utils.Constants.STORED:
              _centralHeader.compressedSize = _centralHeader.size;
              compressedData = Buffer.alloc(uncompressedData.length);
              uncompressedData.copy(compressedData);
              if (async && callback) callback(compressedData);
              return compressedData;
            default:
            case Utils.Constants.DEFLATED:
              var deflater = new Methods.Deflater(uncompressedData);
              if (!async) {
                var deflated = deflater.deflate();
                _centralHeader.compressedSize = deflated.length;
                return deflated;
              } else {
                deflater.deflateAsync(function(data) {
                  compressedData = Buffer.alloc(data.length);
                  _centralHeader.compressedSize = data.length;
                  data.copy(compressedData);
                  callback && callback(compressedData);
                });
              }
              deflater = null;
              break;
          }
        } else if (async && callback) {
          callback(Buffer.alloc(0));
        } else {
          return Buffer.alloc(0);
        }
      }
      function readUInt64LE(buffer, offset) {
        return (buffer.readUInt32LE(offset + 4) << 4) + buffer.readUInt32LE(offset);
      }
      function parseExtra(data) {
        try {
          var offset = 0;
          var signature, size, part;
          while (offset + 4 < data.length) {
            signature = data.readUInt16LE(offset);
            offset += 2;
            size = data.readUInt16LE(offset);
            offset += 2;
            part = data.slice(offset, offset + size);
            offset += size;
            if (Constants.ID_ZIP64 === signature) {
              parseZip64ExtendedInformation(part);
            }
          }
        } catch (error) {
          throw Utils.Errors.EXTRA_FIELD_PARSE_ERROR();
        }
      }
      function parseZip64ExtendedInformation(data) {
        var size, compressedSize, offset, diskNumStart;
        if (data.length >= Constants.EF_ZIP64_SCOMP) {
          size = readUInt64LE(data, Constants.EF_ZIP64_SUNCOMP);
          if (_centralHeader.size === Constants.EF_ZIP64_OR_32) {
            _centralHeader.size = size;
          }
        }
        if (data.length >= Constants.EF_ZIP64_RHO) {
          compressedSize = readUInt64LE(data, Constants.EF_ZIP64_SCOMP);
          if (_centralHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
            _centralHeader.compressedSize = compressedSize;
          }
        }
        if (data.length >= Constants.EF_ZIP64_DSN) {
          offset = readUInt64LE(data, Constants.EF_ZIP64_RHO);
          if (_centralHeader.offset === Constants.EF_ZIP64_OR_32) {
            _centralHeader.offset = offset;
          }
        }
        if (data.length >= Constants.EF_ZIP64_DSN + 4) {
          diskNumStart = data.readUInt32LE(Constants.EF_ZIP64_DSN);
          if (_centralHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
            _centralHeader.diskNumStart = diskNumStart;
          }
        }
      }
      return {
        get entryName() {
          return decoder.decode(_entryName);
        },
        get rawEntryName() {
          return _entryName;
        },
        set entryName(val) {
          _entryName = Utils.toBuffer(val, decoder.encode);
          var lastChar = _entryName[_entryName.length - 1];
          _isDirectory = lastChar === 47 || lastChar === 92;
          _centralHeader.fileNameLength = _entryName.length;
        },
        get efs() {
          if (typeof _efs === "function") {
            return _efs(this.entryName);
          } else {
            return _efs;
          }
        },
        get extra() {
          return _extra;
        },
        set extra(val) {
          _extra = val;
          _centralHeader.extraLength = val.length;
          parseExtra(val);
        },
        get comment() {
          return decoder.decode(_comment);
        },
        set comment(val) {
          _comment = Utils.toBuffer(val, decoder.encode);
          _centralHeader.commentLength = _comment.length;
          if (_comment.length > 65535) throw Utils.Errors.COMMENT_TOO_LONG();
        },
        get name() {
          var n = decoder.decode(_entryName);
          return _isDirectory ? n.substr(n.length - 1).split("/").pop() : n.split("/").pop();
        },
        get isDirectory() {
          return _isDirectory;
        },
        getCompressedData: function() {
          return compress(false, null);
        },
        getCompressedDataAsync: function(callback) {
          compress(true, callback);
        },
        setData: function(value) {
          uncompressedData = Utils.toBuffer(value, Utils.decoder.encode);
          if (!_isDirectory && uncompressedData.length) {
            _centralHeader.size = uncompressedData.length;
            _centralHeader.method = Utils.Constants.DEFLATED;
            _centralHeader.crc = Utils.crc32(value);
            _centralHeader.changed = true;
          } else {
            _centralHeader.method = Utils.Constants.STORED;
          }
        },
        getData: function(pass) {
          if (_centralHeader.changed) {
            return uncompressedData;
          } else {
            return decompress(false, null, pass);
          }
        },
        getDataAsync: function(callback, pass) {
          if (_centralHeader.changed) {
            callback(uncompressedData);
          } else {
            decompress(true, callback, pass);
          }
        },
        set attr(attr) {
          _centralHeader.attr = attr;
        },
        get attr() {
          return _centralHeader.attr;
        },
        set header(data) {
          _centralHeader.loadFromBinary(data);
        },
        get header() {
          return _centralHeader;
        },
        packCentralHeader: function() {
          _centralHeader.flags_efs = this.efs;
          _centralHeader.extraLength = _extra.length;
          var header = _centralHeader.centralHeaderToBinary();
          var addpos = Utils.Constants.CENHDR;
          _entryName.copy(header, addpos);
          addpos += _entryName.length;
          _extra.copy(header, addpos);
          addpos += _centralHeader.extraLength;
          _comment.copy(header, addpos);
          return header;
        },
        packLocalHeader: function() {
          let addpos = 0;
          _centralHeader.flags_efs = this.efs;
          _centralHeader.extraLocalLength = _extralocal.length;
          const localHeaderBuf = _centralHeader.localHeaderToBinary();
          const localHeader = Buffer.alloc(localHeaderBuf.length + _entryName.length + _centralHeader.extraLocalLength);
          localHeaderBuf.copy(localHeader, addpos);
          addpos += localHeaderBuf.length;
          _entryName.copy(localHeader, addpos);
          addpos += _entryName.length;
          _extralocal.copy(localHeader, addpos);
          addpos += _extralocal.length;
          return localHeader;
        },
        toJSON: function() {
          const bytes = function(nr) {
            return "<" + (nr && nr.length + " bytes buffer" || "null") + ">";
          };
          return {
            entryName: this.entryName,
            name: this.name,
            comment: this.comment,
            isDirectory: this.isDirectory,
            header: _centralHeader.toJSON(),
            compressedData: bytes(input),
            data: bytes(uncompressedData)
          };
        },
        toString: function() {
          return JSON.stringify(this.toJSON(), null, "	");
        }
      };
    };
  }
});

// ../../../adm-zip/zipFile.js
var require_zipFile = __commonJS({
  "../../../adm-zip/zipFile.js"(exports2, module2) {
    var ZipEntry = require_zipEntry();
    var Headers = require_headers();
    var Utils = require_util();
    module2.exports = function(inBuffer, options) {
      var entryList = [], entryTable = {}, _comment = Buffer.alloc(0), mainHeader = new Headers.MainHeader(), loadedEntries = false;
      var password = null;
      const temporary = /* @__PURE__ */ new Set();
      const opts = options;
      const { noSort, decoder } = opts;
      if (inBuffer) {
        readMainHeader(opts.readEntries);
      } else {
        loadedEntries = true;
      }
      function makeTemporaryFolders() {
        const foldersList = /* @__PURE__ */ new Set();
        for (const elem of Object.keys(entryTable)) {
          const elements = elem.split("/");
          elements.pop();
          if (!elements.length) continue;
          for (let i = 0; i < elements.length; i++) {
            const sub = elements.slice(0, i + 1).join("/") + "/";
            foldersList.add(sub);
          }
        }
        for (const elem of foldersList) {
          if (!(elem in entryTable)) {
            const tempfolder = new ZipEntry(opts);
            tempfolder.entryName = elem;
            tempfolder.attr = 16;
            tempfolder.temporary = true;
            entryList.push(tempfolder);
            entryTable[tempfolder.entryName] = tempfolder;
            temporary.add(tempfolder);
          }
        }
      }
      function readEntries() {
        loadedEntries = true;
        entryTable = {};
        if (mainHeader.diskEntries > (inBuffer.length - mainHeader.offset) / Utils.Constants.CENHDR) {
          throw Utils.Errors.DISK_ENTRY_TOO_LARGE();
        }
        entryList = new Array(mainHeader.diskEntries);
        var index = mainHeader.offset;
        for (var i = 0; i < entryList.length; i++) {
          var tmp = index, entry = new ZipEntry(opts, inBuffer);
          entry.header = inBuffer.slice(tmp, tmp += Utils.Constants.CENHDR);
          entry.entryName = inBuffer.slice(tmp, tmp += entry.header.fileNameLength);
          if (entry.header.extraLength) {
            entry.extra = inBuffer.slice(tmp, tmp += entry.header.extraLength);
          }
          if (entry.header.commentLength) entry.comment = inBuffer.slice(tmp, tmp + entry.header.commentLength);
          index += entry.header.centralHeaderSize;
          entryList[i] = entry;
          entryTable[entry.entryName] = entry;
        }
        temporary.clear();
        makeTemporaryFolders();
      }
      function readMainHeader(readNow) {
        var i = inBuffer.length - Utils.Constants.ENDHDR, max = Math.max(0, i - 65535), n = max, endStart = inBuffer.length, endOffset = -1, commentEnd = 0;
        const trailingSpace = typeof opts.trailingSpace === "boolean" ? opts.trailingSpace : false;
        if (trailingSpace) max = 0;
        for (i; i >= n; i--) {
          if (inBuffer[i] !== 80) continue;
          if (inBuffer.readUInt32LE(i) === Utils.Constants.ENDSIG) {
            endOffset = i;
            commentEnd = i;
            endStart = i + Utils.Constants.ENDHDR;
            n = i - Utils.Constants.END64HDR;
            continue;
          }
          if (inBuffer.readUInt32LE(i) === Utils.Constants.END64SIG) {
            n = max;
            continue;
          }
          if (inBuffer.readUInt32LE(i) === Utils.Constants.ZIP64SIG) {
            endOffset = i;
            endStart = i + Utils.readBigUInt64LE(inBuffer, i + Utils.Constants.ZIP64SIZE) + Utils.Constants.ZIP64LEAD;
            break;
          }
        }
        if (endOffset == -1) throw Utils.Errors.INVALID_FORMAT();
        mainHeader.loadFromBinary(inBuffer.slice(endOffset, endStart));
        if (mainHeader.commentLength) {
          _comment = inBuffer.slice(commentEnd + Utils.Constants.ENDHDR);
        }
        if (readNow) readEntries();
      }
      function sortEntries() {
        if (entryList.length > 1 && !noSort) {
          entryList.sort((a, b) => a.entryName.toLowerCase().localeCompare(b.entryName.toLowerCase()));
        }
      }
      return {
        /**
         * Returns an array of ZipEntry objects existent in the current opened archive
         * @return Array
         */
        get entries() {
          if (!loadedEntries) {
            readEntries();
          }
          return entryList.filter((e) => !temporary.has(e));
        },
        /**
         * Archive comment
         * @return {String}
         */
        get comment() {
          return decoder.decode(_comment);
        },
        set comment(val) {
          _comment = Utils.toBuffer(val, decoder.encode);
          mainHeader.commentLength = _comment.length;
        },
        getEntryCount: function() {
          if (!loadedEntries) {
            return mainHeader.diskEntries;
          }
          return entryList.length;
        },
        forEach: function(callback) {
          this.entries.forEach(callback);
        },
        /**
         * Returns a reference to the entry with the given name or null if entry is inexistent
         *
         * @param entryName
         * @return ZipEntry
         */
        getEntry: function(entryName) {
          if (!loadedEntries) {
            readEntries();
          }
          return entryTable[entryName] || null;
        },
        /**
         * Adds the given entry to the entry list
         *
         * @param entry
         */
        setEntry: function(entry) {
          if (!loadedEntries) {
            readEntries();
          }
          entryList.push(entry);
          entryTable[entry.entryName] = entry;
          mainHeader.totalEntries = entryList.length;
        },
        /**
         * Removes the file with the given name from the entry list.
         *
         * If the entry is a directory, then all nested files and directories will be removed
         * @param entryName
         * @returns {void}
         */
        deleteFile: function(entryName, withsubfolders = true) {
          if (!loadedEntries) {
            readEntries();
          }
          const entry = entryTable[entryName];
          const list = this.getEntryChildren(entry, withsubfolders).map((child) => child.entryName);
          list.forEach(this.deleteEntry);
        },
        /**
         * Removes the entry with the given name from the entry list.
         *
         * @param {string} entryName
         * @returns {void}
         */
        deleteEntry: function(entryName) {
          if (!loadedEntries) {
            readEntries();
          }
          const entry = entryTable[entryName];
          const index = entryList.indexOf(entry);
          if (index >= 0) {
            entryList.splice(index, 1);
            delete entryTable[entryName];
            mainHeader.totalEntries = entryList.length;
          }
        },
        /**
         *  Iterates and returns all nested files and directories of the given entry
         *
         * @param entry
         * @return Array
         */
        getEntryChildren: function(entry, subfolders = true) {
          if (!loadedEntries) {
            readEntries();
          }
          if (typeof entry === "object") {
            if (entry.isDirectory && subfolders) {
              const list = [];
              const name = entry.entryName;
              for (const zipEntry of entryList) {
                if (zipEntry.entryName.startsWith(name)) {
                  list.push(zipEntry);
                }
              }
              return list;
            } else {
              return [entry];
            }
          }
          return [];
        },
        /**
         *  How many child elements entry has
         *
         * @param {ZipEntry} entry
         * @return {integer}
         */
        getChildCount: function(entry) {
          if (entry && entry.isDirectory) {
            const list = this.getEntryChildren(entry);
            return list.includes(entry) ? list.length - 1 : list.length;
          }
          return 0;
        },
        /**
         * Returns the zip file
         *
         * @return Buffer
         */
        compressToBuffer: function() {
          if (!loadedEntries) {
            readEntries();
          }
          sortEntries();
          const dataBlock = [];
          const headerBlocks = [];
          let totalSize = 0;
          let dindex = 0;
          mainHeader.size = 0;
          mainHeader.offset = 0;
          let totalEntries = 0;
          for (const entry of this.entries) {
            const compressedData = entry.getCompressedData();
            entry.header.offset = dindex;
            const localHeader = entry.packLocalHeader();
            const dataLength = localHeader.length + compressedData.length;
            dindex += dataLength;
            dataBlock.push(localHeader);
            dataBlock.push(compressedData);
            const centralHeader = entry.packCentralHeader();
            headerBlocks.push(centralHeader);
            mainHeader.size += centralHeader.length;
            totalSize += dataLength + centralHeader.length;
            totalEntries++;
          }
          totalSize += mainHeader.mainHeaderSize;
          mainHeader.offset = dindex;
          mainHeader.totalEntries = totalEntries;
          dindex = 0;
          const outBuffer = Buffer.alloc(totalSize);
          for (const content of dataBlock) {
            content.copy(outBuffer, dindex);
            dindex += content.length;
          }
          for (const content of headerBlocks) {
            content.copy(outBuffer, dindex);
            dindex += content.length;
          }
          const mh = mainHeader.toBinary();
          if (_comment) {
            _comment.copy(mh, Utils.Constants.ENDHDR);
          }
          mh.copy(outBuffer, dindex);
          inBuffer = outBuffer;
          loadedEntries = false;
          return outBuffer;
        },
        toAsyncBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
          try {
            if (!loadedEntries) {
              readEntries();
            }
            sortEntries();
            const dataBlock = [];
            const centralHeaders = [];
            let totalSize = 0;
            let dindex = 0;
            let totalEntries = 0;
            mainHeader.size = 0;
            mainHeader.offset = 0;
            const compress2Buffer = function(entryLists) {
              if (entryLists.length > 0) {
                const entry = entryLists.shift();
                const name = entry.entryName + entry.extra.toString();
                if (onItemStart) onItemStart(name);
                entry.getCompressedDataAsync(function(compressedData) {
                  if (onItemEnd) onItemEnd(name);
                  entry.header.offset = dindex;
                  const localHeader = entry.packLocalHeader();
                  const dataLength = localHeader.length + compressedData.length;
                  dindex += dataLength;
                  dataBlock.push(localHeader);
                  dataBlock.push(compressedData);
                  const centalHeader = entry.packCentralHeader();
                  centralHeaders.push(centalHeader);
                  mainHeader.size += centalHeader.length;
                  totalSize += dataLength + centalHeader.length;
                  totalEntries++;
                  compress2Buffer(entryLists);
                });
              } else {
                totalSize += mainHeader.mainHeaderSize;
                mainHeader.offset = dindex;
                mainHeader.totalEntries = totalEntries;
                dindex = 0;
                const outBuffer = Buffer.alloc(totalSize);
                dataBlock.forEach(function(content) {
                  content.copy(outBuffer, dindex);
                  dindex += content.length;
                });
                centralHeaders.forEach(function(content) {
                  content.copy(outBuffer, dindex);
                  dindex += content.length;
                });
                const mh = mainHeader.toBinary();
                if (_comment) {
                  _comment.copy(mh, Utils.Constants.ENDHDR);
                }
                mh.copy(outBuffer, dindex);
                inBuffer = outBuffer;
                loadedEntries = false;
                onSuccess(outBuffer);
              }
            };
            compress2Buffer(Array.from(this.entries));
          } catch (e) {
            onFail(e);
          }
        }
      };
    };
  }
});

// ../../../adm-zip/adm-zip.js
var require_adm_zip = __commonJS({
  "../../../adm-zip/adm-zip.js"(exports2, module2) {
    var Utils = require_util();
    var pth = require("path");
    var ZipEntry = require_zipEntry();
    var ZipFile = require_zipFile();
    var get_Bool = (...val) => Utils.findLast(val, (c) => typeof c === "boolean");
    var get_Str = (...val) => Utils.findLast(val, (c) => typeof c === "string");
    var get_Fun = (...val) => Utils.findLast(val, (c) => typeof c === "function");
    var defaultOptions = {
      // option "noSort" : if true it disables files sorting
      noSort: false,
      // read entries during load (initial loading may be slower)
      readEntries: false,
      // default method is none
      method: Utils.Constants.NONE,
      // file system
      fs: null
    };
    module2.exports = function(input, options) {
      let inBuffer = null;
      const opts = Object.assign(/* @__PURE__ */ Object.create(null), defaultOptions);
      if (input && "object" === typeof input) {
        if (!(input instanceof Uint8Array)) {
          Object.assign(opts, input);
          input = opts.input ? opts.input : void 0;
          if (opts.input) delete opts.input;
        }
        if (Buffer.isBuffer(input)) {
          inBuffer = input;
          opts.method = Utils.Constants.BUFFER;
          input = void 0;
        }
      }
      Object.assign(opts, options);
      const filetools = new Utils(opts);
      if (typeof opts.decoder !== "object" || typeof opts.decoder.encode !== "function" || typeof opts.decoder.decode !== "function") {
        opts.decoder = Utils.decoder;
      }
      if (input && "string" === typeof input) {
        if (filetools.fs.existsSync(input)) {
          opts.method = Utils.Constants.FILE;
          opts.filename = input;
          inBuffer = filetools.fs.readFileSync(input);
        } else {
          throw Utils.Errors.INVALID_FILENAME();
        }
      }
      const _zip = new ZipFile(inBuffer, opts);
      const { canonical, sanitize, zipnamefix } = Utils;
      function getEntry(entry) {
        if (entry && _zip) {
          var item;
          if (typeof entry === "string") item = _zip.getEntry(pth.posix.normalize(entry));
          if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined") item = _zip.getEntry(entry.entryName);
          if (item) {
            return item;
          }
        }
        return null;
      }
      function fixPath(zipPath) {
        const { join: join6, normalize, sep } = pth.posix;
        return join6(".", normalize(sep + zipPath.split("\\").join(sep) + sep));
      }
      function filenameFilter(filterfn) {
        if (filterfn instanceof RegExp) {
          return /* @__PURE__ */ (function(rx) {
            return function(filename) {
              return rx.test(filename);
            };
          })(filterfn);
        } else if ("function" !== typeof filterfn) {
          return () => true;
        }
        return filterfn;
      }
      const relativePath = (local, entry) => {
        let lastChar = entry.slice(-1);
        lastChar = lastChar === filetools.sep ? filetools.sep : "";
        return pth.relative(local, entry) + lastChar;
      };
      return {
        /**
         * Extracts the given entry from the archive and returns the content as a Buffer object
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {Buffer|string} [pass] - password
         * @return Buffer or Null in case of error
         */
        readFile: function(entry, pass) {
          var item = getEntry(entry);
          return item && item.getData(pass) || null;
        },
        /**
         * Returns how many child elements has on entry (directories) on files it is always 0
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @returns {integer}
         */
        childCount: function(entry) {
          const item = getEntry(entry);
          if (item) {
            return _zip.getChildCount(item);
          }
        },
        /**
         * Asynchronous readFile
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {callback} callback
         *
         * @return Buffer or Null in case of error
         */
        readFileAsync: function(entry, callback) {
          var item = getEntry(entry);
          if (item) {
            item.getDataAsync(callback);
          } else {
            callback(null, "getEntry failed for:" + entry);
          }
        },
        /**
         * Extracts the given entry from the archive and returns the content as plain text in the given encoding
         * @param {ZipEntry|string} entry - ZipEntry object or String with the full path of the entry
         * @param {string} encoding - Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsText: function(entry, encoding) {
          var item = getEntry(entry);
          if (item) {
            var data = item.getData();
            if (data && data.length) {
              return data.toString(encoding || "utf8");
            }
          }
          return "";
        },
        /**
         * Asynchronous readAsText
         * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
         * @param {callback} callback
         * @param {string} [encoding] - Optional. If no encoding is specified utf8 is used
         *
         * @return String
         */
        readAsTextAsync: function(entry, callback, encoding) {
          var item = getEntry(entry);
          if (item) {
            item.getDataAsync(function(data, err) {
              if (err) {
                callback(data, err);
                return;
              }
              if (data && data.length) {
                callback(data.toString(encoding || "utf8"));
              } else {
                callback("");
              }
            });
          } else {
            callback("");
          }
        },
        /**
         * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
         *
         * @param {ZipEntry|string} entry
         * @returns {void}
         */
        deleteFile: function(entry, withsubfolders = true) {
          var item = getEntry(entry);
          if (item) {
            _zip.deleteFile(item.entryName, withsubfolders);
          }
        },
        /**
         * Remove the entry from the file or directory without affecting any nested entries
         *
         * @param {ZipEntry|string} entry
         * @returns {void}
         */
        deleteEntry: function(entry) {
          var item = getEntry(entry);
          if (item) {
            _zip.deleteEntry(item.entryName);
          }
        },
        /**
         * Adds a comment to the zip. The zip must be rewritten after adding the comment.
         *
         * @param {string} comment
         */
        addZipComment: function(comment) {
          _zip.comment = comment;
        },
        /**
         * Returns the zip comment
         *
         * @return String
         */
        getZipComment: function() {
          return _zip.comment || "";
        },
        /**
         * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
         * The comment cannot exceed 65535 characters in length
         *
         * @param {ZipEntry} entry
         * @param {string} comment
         */
        addZipEntryComment: function(entry, comment) {
          var item = getEntry(entry);
          if (item) {
            item.comment = comment;
          }
        },
        /**
         * Returns the comment of the specified entry
         *
         * @param {ZipEntry} entry
         * @return String
         */
        getZipEntryComment: function(entry) {
          var item = getEntry(entry);
          if (item) {
            return item.comment || "";
          }
          return "";
        },
        /**
         * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
         *
         * @param {ZipEntry} entry
         * @param {Buffer} content
         */
        updateFile: function(entry, content) {
          var item = getEntry(entry);
          if (item) {
            item.setData(content);
          }
        },
        /**
         * Adds a file from the disk to the archive
         *
         * @param {string} localPath File to add to zip
         * @param {string} [zipPath] Optional path inside the zip
         * @param {string} [zipName] Optional name for the file
         * @param {string} [comment] Optional file comment
         */
        addLocalFile: function(localPath2, zipPath, zipName, comment) {
          if (filetools.fs.existsSync(localPath2)) {
            zipPath = zipPath ? fixPath(zipPath) : "";
            const p = pth.win32.basename(pth.win32.normalize(localPath2));
            zipPath += zipName ? zipName : p;
            const _attr = filetools.fs.statSync(localPath2);
            const data = _attr.isFile() ? filetools.fs.readFileSync(localPath2) : Buffer.alloc(0);
            if (_attr.isDirectory()) zipPath += filetools.sep;
            this.addFile(zipPath, data, comment, _attr);
          } else {
            throw Utils.Errors.FILE_NOT_FOUND(localPath2);
          }
        },
        /**
         * Callback for showing if everything was done.
         *
         * @callback doneCallback
         * @param {Error} err - Error object
         * @param {boolean} done - was request fully completed
         */
        /**
         * Adds a file from the disk to the archive
         *
         * @param {(object|string)} options - options object, if it is string it us used as localPath.
         * @param {string} options.localPath - Local path to the file.
         * @param {string} [options.comment] - Optional file comment.
         * @param {string} [options.zipPath] - Optional path inside the zip
         * @param {string} [options.zipName] - Optional name for the file
         * @param {doneCallback} callback - The callback that handles the response.
         */
        addLocalFileAsync: function(options2, callback) {
          options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
          const localPath2 = pth.resolve(options2.localPath);
          const { comment } = options2;
          let { zipPath, zipName } = options2;
          const self = this;
          filetools.fs.stat(localPath2, function(err, stats) {
            if (err) return callback(err, false);
            zipPath = zipPath ? fixPath(zipPath) : "";
            const p = pth.win32.basename(pth.win32.normalize(localPath2));
            zipPath += zipName ? zipName : p;
            if (stats.isFile()) {
              filetools.fs.readFile(localPath2, function(err2, data) {
                if (err2) return callback(err2, false);
                self.addFile(zipPath, data, comment, stats);
                return setImmediate(callback, void 0, true);
              });
            } else if (stats.isDirectory()) {
              zipPath += filetools.sep;
              self.addFile(zipPath, Buffer.alloc(0), comment, stats);
              return setImmediate(callback, void 0, true);
            }
          });
        },
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {string} localPath - local path to the folder
         * @param {string} [zipPath] - optional path inside zip
         * @param {(RegExp|function)} [filter] - optional RegExp or Function if files match will be included.
         */
        addLocalFolder: function(localPath2, zipPath, filter) {
          filter = filenameFilter(filter);
          zipPath = zipPath ? fixPath(zipPath) : "";
          localPath2 = pth.normalize(localPath2);
          if (filetools.fs.existsSync(localPath2)) {
            const items = filetools.findFiles(localPath2);
            const self = this;
            if (items.length) {
              for (const filepath of items) {
                const p = pth.join(zipPath, relativePath(localPath2, filepath));
                if (filter(p)) {
                  self.addLocalFile(filepath, pth.dirname(p));
                }
              }
            }
          } else {
            throw Utils.Errors.FILE_NOT_FOUND(localPath2);
          }
        },
        /**
         * Asynchronous addLocalFolder
         * @param {string} localPath
         * @param {callback} callback
         * @param {string} [zipPath] optional path inside zip
         * @param {RegExp|function} [filter] optional RegExp or Function if files match will
         *               be included.
         */
        addLocalFolderAsync: function(localPath2, callback, zipPath, filter) {
          filter = filenameFilter(filter);
          zipPath = zipPath ? fixPath(zipPath) : "";
          localPath2 = pth.normalize(localPath2);
          var self = this;
          filetools.fs.open(localPath2, "r", function(err) {
            if (err && err.code === "ENOENT") {
              callback(void 0, Utils.Errors.FILE_NOT_FOUND(localPath2));
            } else if (err) {
              callback(void 0, err);
            } else {
              var items = filetools.findFiles(localPath2);
              var i = -1;
              var next = function() {
                i += 1;
                if (i < items.length) {
                  var filepath = items[i];
                  var p = relativePath(localPath2, filepath).split("\\").join("/");
                  p = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
                  if (filter(p)) {
                    filetools.fs.stat(filepath, function(er0, stats) {
                      if (er0) callback(void 0, er0);
                      if (stats.isFile()) {
                        filetools.fs.readFile(filepath, function(er1, data) {
                          if (er1) {
                            callback(void 0, er1);
                          } else {
                            self.addFile(zipPath + p, data, "", stats);
                            next();
                          }
                        });
                      } else {
                        self.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                        next();
                      }
                    });
                  } else {
                    process.nextTick(() => {
                      next();
                    });
                  }
                } else {
                  callback(true, void 0);
                }
              };
              next();
            }
          });
        },
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {object | string} options - options object, if it is string it us used as localPath.
         * @param {string} options.localPath - Local path to the folder.
         * @param {string} [options.zipPath] - optional path inside zip.
         * @param {RegExp|function} [options.filter] - optional RegExp or Function if files match will be included.
         * @param {function|string} [options.namefix] - optional function to help fix filename
         * @param {doneCallback} callback - The callback that handles the response.
         *
         */
        addLocalFolderAsync2: function(options2, callback) {
          const self = this;
          options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
          localPath = pth.resolve(fixPath(options2.localPath));
          let { zipPath, filter, namefix } = options2;
          if (filter instanceof RegExp) {
            filter = /* @__PURE__ */ (function(rx) {
              return function(filename) {
                return rx.test(filename);
              };
            })(filter);
          } else if ("function" !== typeof filter) {
            filter = function() {
              return true;
            };
          }
          zipPath = zipPath ? fixPath(zipPath) : "";
          if (namefix == "latin1") {
            namefix = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
          }
          if (typeof namefix !== "function") namefix = (str) => str;
          const relPathFix = (entry) => pth.join(zipPath, namefix(relativePath(localPath, entry)));
          const fileNameFix = (entry) => pth.win32.basename(pth.win32.normalize(namefix(entry)));
          filetools.fs.open(localPath, "r", function(err) {
            if (err && err.code === "ENOENT") {
              callback(void 0, Utils.Errors.FILE_NOT_FOUND(localPath));
            } else if (err) {
              callback(void 0, err);
            } else {
              filetools.findFilesAsync(localPath, function(err2, fileEntries) {
                if (err2) return callback(err2);
                fileEntries = fileEntries.filter((dir) => filter(relPathFix(dir)));
                if (!fileEntries.length) callback(void 0, false);
                setImmediate(
                  fileEntries.reverse().reduce(function(next, entry) {
                    return function(err3, done) {
                      if (err3 || done === false) return setImmediate(next, err3, false);
                      self.addLocalFileAsync(
                        {
                          localPath: entry,
                          zipPath: pth.dirname(relPathFix(entry)),
                          zipName: fileNameFix(entry)
                        },
                        next
                      );
                    };
                  }, callback)
                );
              });
            }
          });
        },
        /**
         * Adds a local directory and all its nested files and directories to the archive
         *
         * @param {string} localPath - path where files will be extracted
         * @param {object} props - optional properties
         * @param {string} [props.zipPath] - optional path inside zip
         * @param {RegExp|function} [props.filter] - optional RegExp or Function if files match will be included.
         * @param {function|string} [props.namefix] - optional function to help fix filename
         */
        addLocalFolderPromise: function(localPath2, props) {
          return new Promise((resolve, reject) => {
            this.addLocalFolderAsync2(Object.assign({ localPath: localPath2 }, props), (err, done) => {
              if (err) reject(err);
              if (done) resolve(this);
            });
          });
        },
        /**
         * Allows you to create a entry (file or directory) in the zip file.
         * If you want to create a directory the entryName must end in / and a null buffer should be provided.
         * Comment and attributes are optional
         *
         * @param {string} entryName
         * @param {Buffer | string} content - file content as buffer or utf8 coded string
         * @param {string} [comment] - file comment
         * @param {number | object} [attr] - number as unix file permissions, object as filesystem Stats object
         */
        addFile: function(entryName, content, comment, attr) {
          entryName = zipnamefix(entryName);
          let entry = getEntry(entryName);
          const update = entry != null;
          if (!update) {
            entry = new ZipEntry(opts);
            entry.entryName = entryName;
          }
          entry.comment = comment || "";
          const isStat = "object" === typeof attr && attr instanceof filetools.fs.Stats;
          if (isStat) {
            entry.header.time = attr.mtime;
          }
          var fileattr = entry.isDirectory ? 16 : 0;
          let unix = entry.isDirectory ? 16384 : 32768;
          if (isStat) {
            unix |= 4095 & attr.mode;
          } else if ("number" === typeof attr) {
            unix |= 4095 & attr;
          } else {
            unix |= entry.isDirectory ? 493 : 420;
          }
          fileattr = (fileattr | unix << 16) >>> 0;
          entry.attr = fileattr;
          entry.setData(content);
          if (!update) _zip.setEntry(entry);
          return entry;
        },
        /**
         * Returns an array of ZipEntry objects representing the files and folders inside the archive
         *
         * @param {string} [password]
         * @returns Array
         */
        getEntries: function(password) {
          _zip.password = password;
          return _zip ? _zip.entries : [];
        },
        /**
         * Returns a ZipEntry object representing the file or folder specified by ``name``.
         *
         * @param {string} name
         * @return ZipEntry
         */
        getEntry: function(name) {
          return getEntry(name);
        },
        getEntryCount: function() {
          return _zip.getEntryCount();
        },
        forEach: function(callback) {
          return _zip.forEach(callback);
        },
        /**
         * Extracts the given entry to the given targetPath
         * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
         *
         * @param {string|ZipEntry} entry - ZipEntry object or String with the full path of the entry
         * @param {string} targetPath - Target folder where to write the file
         * @param {boolean} [maintainEntryPath=true] - If maintainEntryPath is true and the entry is inside a folder, the entry folder will be created in targetPath as well. Default is TRUE
         * @param {boolean} [overwrite=false] - If the file already exists at the target path, the file will be overwriten if this is true.
         * @param {boolean} [keepOriginalPermission=false] - The file will be set as the permission from the entry if this is true.
         * @param {string} [outFileName] - String If set will override the filename of the extracted file (Only works if the entry is a file)
         *
         * @return Boolean
         */
        extractEntryTo: function(entry, targetPath, maintainEntryPath, overwrite, keepOriginalPermission, outFileName) {
          overwrite = get_Bool(false, overwrite);
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          maintainEntryPath = get_Bool(true, maintainEntryPath);
          outFileName = get_Str(keepOriginalPermission, outFileName);
          var item = getEntry(entry);
          if (!item) {
            throw Utils.Errors.NO_ENTRY();
          }
          var entryName = canonical(item.entryName);
          var target = sanitize(targetPath, outFileName && !item.isDirectory ? outFileName : maintainEntryPath ? entryName : pth.basename(entryName));
          if (item.isDirectory) {
            var children = _zip.getEntryChildren(item);
            children.forEach(function(child) {
              if (child.isDirectory) return;
              var content2 = child.getData();
              if (!content2) {
                throw Utils.Errors.CANT_EXTRACT_FILE();
              }
              var name = canonical(child.entryName);
              var childName = sanitize(targetPath, maintainEntryPath ? name : pth.basename(name));
              const fileAttr2 = keepOriginalPermission ? child.header.fileAttr : void 0;
              filetools.writeFileTo(childName, content2, overwrite, fileAttr2);
            });
            return true;
          }
          var content = item.getData(_zip.password);
          if (!content) throw Utils.Errors.CANT_EXTRACT_FILE();
          if (filetools.fs.existsSync(target) && !overwrite) {
            throw Utils.Errors.CANT_OVERRIDE();
          }
          const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
          filetools.writeFileTo(target, content, overwrite, fileAttr);
          return true;
        },
        /**
         * Test the archive
         * @param {string} [pass]
         */
        test: function(pass) {
          if (!_zip) {
            return false;
          }
          for (var entry in _zip.entries) {
            try {
              if (entry.isDirectory) {
                continue;
              }
              var content = _zip.entries[entry].getData(pass);
              if (!content) {
                return false;
              }
            } catch (err) {
              return false;
            }
          }
          return true;
        },
        /**
         * Extracts the entire archive to the given location
         *
         * @param {string} targetPath Target location
         * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param {string|Buffer} [pass] password
         */
        extractAllTo: function(targetPath, overwrite, keepOriginalPermission, pass) {
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          pass = get_Str(keepOriginalPermission, pass);
          overwrite = get_Bool(false, overwrite);
          if (!_zip) throw Utils.Errors.NO_ZIP();
          _zip.entries.forEach(function(entry) {
            var entryName = sanitize(targetPath, canonical(entry.entryName));
            if (entry.isDirectory) {
              filetools.makeDir(entryName);
              return;
            }
            var content = entry.getData(pass);
            if (!content) {
              throw Utils.Errors.CANT_EXTRACT_FILE();
            }
            const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
            filetools.writeFileTo(entryName, content, overwrite, fileAttr);
            try {
              filetools.fs.utimesSync(entryName, entry.header.time, entry.header.time);
            } catch (err) {
              throw Utils.Errors.CANT_EXTRACT_FILE();
            }
          });
        },
        /**
         * Asynchronous extractAllTo
         *
         * @param {string} targetPath Target location
         * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
         *                  Default is FALSE
         * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
         *                  Default is FALSE
         * @param {function} callback The callback will be executed when all entries are extracted successfully or any error is thrown.
         */
        extractAllToAsync: function(targetPath, overwrite, keepOriginalPermission, callback) {
          callback = get_Fun(overwrite, keepOriginalPermission, callback);
          keepOriginalPermission = get_Bool(false, keepOriginalPermission);
          overwrite = get_Bool(false, overwrite);
          if (!callback) {
            return new Promise((resolve, reject) => {
              this.extractAllToAsync(targetPath, overwrite, keepOriginalPermission, function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve(this);
                }
              });
            });
          }
          if (!_zip) {
            callback(Utils.Errors.NO_ZIP());
            return;
          }
          targetPath = pth.resolve(targetPath);
          const getPath = (entry) => sanitize(targetPath, pth.normalize(canonical(entry.entryName)));
          const getError = (msg, file) => new Error(msg + ': "' + file + '"');
          const dirEntries = [];
          const fileEntries = [];
          _zip.entries.forEach((e) => {
            if (e.isDirectory) {
              dirEntries.push(e);
            } else {
              fileEntries.push(e);
            }
          });
          for (const entry of dirEntries) {
            const dirPath = getPath(entry);
            const dirAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
            try {
              filetools.makeDir(dirPath);
              if (dirAttr) filetools.fs.chmodSync(dirPath, dirAttr);
              filetools.fs.utimesSync(dirPath, entry.header.time, entry.header.time);
            } catch (er) {
              callback(getError("Unable to create folder", dirPath));
            }
          }
          fileEntries.reverse().reduce(function(next, entry) {
            return function(err) {
              if (err) {
                next(err);
              } else {
                const entryName = pth.normalize(canonical(entry.entryName));
                const filePath = sanitize(targetPath, entryName);
                entry.getDataAsync(function(content, err_1) {
                  if (err_1) {
                    next(err_1);
                  } else if (!content) {
                    next(Utils.Errors.CANT_EXTRACT_FILE());
                  } else {
                    const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
                    filetools.writeFileToAsync(filePath, content, overwrite, fileAttr, function(succ) {
                      if (!succ) {
                        next(getError("Unable to write file", filePath));
                      }
                      filetools.fs.utimes(filePath, entry.header.time, entry.header.time, function(err_2) {
                        if (err_2) {
                          next(getError("Unable to set times", filePath));
                        } else {
                          next();
                        }
                      });
                    });
                  }
                });
              }
            };
          }, callback)();
        },
        /**
         * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
         *
         * @param {string} targetFileName
         * @param {function} callback
         */
        writeZip: function(targetFileName, callback) {
          if (arguments.length === 1) {
            if (typeof targetFileName === "function") {
              callback = targetFileName;
              targetFileName = "";
            }
          }
          if (!targetFileName && opts.filename) {
            targetFileName = opts.filename;
          }
          if (!targetFileName) return;
          var zipData = _zip.compressToBuffer();
          if (zipData) {
            var ok = filetools.writeFileTo(targetFileName, zipData, true);
            if (typeof callback === "function") callback(!ok ? new Error("failed") : null, "");
          }
        },
        /**
                 *
                 * @param {string} targetFileName
                 * @param {object} [props]
                 * @param {boolean} [props.overwrite=true] If the file already exists at the target path, the file will be overwriten if this is true.
                 * @param {boolean} [props.perm] The file will be set as the permission from the entry if this is true.
        
                 * @returns {Promise<void>}
                 */
        writeZipPromise: function(targetFileName, props) {
          const { overwrite, perm } = Object.assign({ overwrite: true }, props);
          return new Promise((resolve, reject) => {
            if (!targetFileName && opts.filename) targetFileName = opts.filename;
            if (!targetFileName) reject("ADM-ZIP: ZIP File Name Missing");
            this.toBufferPromise().then((zipData) => {
              const ret = (done) => done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file");
              filetools.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
            }, reject);
          });
        },
        /**
         * @returns {Promise<Buffer>} A promise to the Buffer.
         */
        toBufferPromise: function() {
          return new Promise((resolve, reject) => {
            _zip.toAsyncBuffer(resolve, reject);
          });
        },
        /**
         * Returns the content of the entire zip file as a Buffer object
         *
         * @prop {function} [onSuccess]
         * @prop {function} [onFail]
         * @prop {function} [onItemStart]
         * @prop {function} [onItemEnd]
         * @returns {Buffer}
         */
        toBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
          if (typeof onSuccess === "function") {
            _zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
            return null;
          }
          return _zip.compressToBuffer();
        }
      };
    };
  }
});

// src/browser/index.ts
var index_exports = {};
__export(index_exports, {
  downloadExtension: () => downloadExtension,
  installChromeWebStore: () => installChromeWebStore,
  installExtension: () => installExtension,
  loadAllExtensions: () => loadAllExtensions,
  uninstallExtension: () => uninstallExtension,
  updateExtensions: () => updateExtensions
});
module.exports = __toCommonJS(index_exports);
var import_electron5 = require("electron");
var path5 = __toESM(require("node:path"));
var import_node_fs = require("node:fs");
var import_node_module = require("node:module");

// src/browser/api.ts
var import_debug3 = __toESM(require_debug());
var import_electron3 = require("electron");

// src/browser/utils.ts
var path = __toESM(require("node:path"));
var import_electron = require("electron");
var fetch = (
  // Prefer Node's fetch until net.fetch crash is fixed
  // https://github.com/electron/electron/pull/45050
  // 3zT: Chromium network stack first (system proxy/certificates, same as the browser)
  ((...a) => import_electron.net.fetch(...a)) || globalThis.fetch || (() => {
    throw new Error(
      "electron-chrome-web-store: Missing fetch API. Please upgrade Electron or Node."
    );
  })
);
var getChromeVersion = () => process.versions.chrome || "131.0.6778.109";
function compareVersions(version1, version2) {
  const v1 = version1.split(".").map(Number);
  const v2 = version2.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (v1[i] > v2[i]) return 1;
    if (v1[i] < v2[i]) return -1;
  }
  return 0;
}
var getDefaultExtensionsPath = () => path.join(import_electron.app.getPath("userData"), "Extensions");

// src/common/constants.ts
var ExtensionInstallStatus = {
  BLACKLISTED: "blacklisted",
  BLOCKED_BY_POLICY: "blocked_by_policy",
  CAN_REQUEST: "can_request",
  CORRUPTED: "corrupted",
  CUSTODIAN_APPROVAL_REQUIRED: "custodian_approval_required",
  CUSTODIAN_APPROVAL_REQUIRED_FOR_INSTALLATION: "custodian_approval_required_for_installation",
  DEPRECATED_MANIFEST_VERSION: "deprecated_manifest_version",
  DISABLED: "disabled",
  ENABLED: "enabled",
  FORCE_INSTALLED: "force_installed",
  INSTALLABLE: "installable",
  REQUEST_PENDING: "request_pending",
  TERMINATED: "terminated"
};
var MV2DeprecationStatus = {
  INACTIVE: "inactive",
  SOFT_DISABLE: "soft_disable",
  WARNING: "warning"
};
var Result = {
  ALREADY_INSTALLED: "already_installed",
  BLACKLISTED: "blacklisted",
  BLOCKED_BY_POLICY: "blocked_by_policy",
  BLOCKED_FOR_CHILD_ACCOUNT: "blocked_for_child_account",
  FEATURE_DISABLED: "feature_disabled",
  ICON_ERROR: "icon_error",
  INSTALL_ERROR: "install_error",
  INSTALL_IN_PROGRESS: "install_in_progress",
  INVALID_ICON_URL: "invalid_icon_url",
  INVALID_ID: "invalid_id",
  LAUNCH_IN_PROGRESS: "launch_in_progress",
  MANIFEST_ERROR: "manifest_error",
  MISSING_DEPENDENCIES: "missing_dependencies",
  SUCCESS: "success",
  UNKNOWN_ERROR: "unknown_error",
  UNSUPPORTED_EXTENSION_TYPE: "unsupported_extension_type",
  USER_CANCELLED: "user_cancelled",
  USER_GESTURE_REQUIRED: "user_gesture_required"
};
var WebGlStatus = {
  WEBGL_ALLOWED: "webgl_allowed",
  WEBGL_BLOCKED: "webgl_blocked"
};

// src/browser/installer.ts
var fs2 = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path3 = __toESM(require("node:path"));
var import_node_stream = require("node:stream");
var import_promises = require("node:stream/promises");
var import_electron2 = require("electron");
var import_adm_zip = __toESM(require_adm_zip());
var import_debug2 = __toESM(require_debug());

// ../../../pbf/index.js
var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
var TEXT_DECODER_MIN_LENGTH = 12;
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
var PBF_VARINT = 0;
var PBF_FIXED64 = 1;
var PBF_BYTES = 2;
var PBF_FIXED32 = 5;
var Pbf = class {
  /**
   * @param {Uint8Array | ArrayBuffer} [buf]
   */
  constructor(buf = new Uint8Array(16)) {
    this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
    this.dataView = new DataView(this.buf.buffer);
    this.pos = 0;
    this.type = 0;
    this.length = this.buf.length;
  }
  // === READING =================================================================
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   * @param {number} [end]
   */
  readFields(readField, result, end = this.length) {
    while (this.pos < end) {
      const val = this.readVarint(), tag = val >> 3, startPos = this.pos;
      this.type = val & 7;
      readField(tag, result, this);
      if (this.pos === startPos) this.skip(val);
    }
    return result;
  }
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   */
  readMessage(readField, result) {
    return this.readFields(readField, result, this.readVarint() + this.pos);
  }
  readFixed32() {
    const val = this.dataView.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readSFixed32() {
    const val = this.dataView.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readSFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readFloat() {
    const val = this.dataView.getFloat32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readDouble() {
    const val = this.dataView.getFloat64(this.pos, true);
    this.pos += 8;
    return val;
  }
  /**
   * @param {boolean} [isSigned]
   */
  readVarint(isSigned) {
    const buf = this.buf;
    let val, b;
    b = buf[this.pos++];
    val = b & 127;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 7;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 14;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 21;
    if (b < 128) return val;
    b = buf[this.pos];
    val |= (b & 15) << 28;
    return readVarintRemainder(val, isSigned, this);
  }
  readVarint64() {
    return this.readVarint(true);
  }
  readSVarint() {
    const num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2;
  }
  readBoolean() {
    return Boolean(this.readVarint());
  }
  readString() {
    const end = this.readVarint() + this.pos;
    const pos = this.pos;
    this.pos = end;
    if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
      return utf8TextDecoder.decode(this.buf.subarray(pos, end));
    }
    return readUtf8(this.buf, pos, end);
  }
  readBytes() {
    const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  }
  // verbose for performance reasons; doesn't affect gzipped size
  /**
   * @param {number[]} [arr]
   * @param {boolean} [isSigned]
   */
  readPackedVarint(arr = [], isSigned) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readVarint(isSigned));
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSVarint(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSVarint());
    return arr;
  }
  /** @param {boolean[]} [arr] */
  readPackedBoolean(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readBoolean());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFloat(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFloat());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedDouble(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readDouble());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed64());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed64());
    return arr;
  }
  readPackedEnd() {
    return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
  }
  /** @param {number} val */
  skip(val) {
    const type = val & 7;
    if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
    }
    else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
    else if (type === PBF_FIXED32) this.pos += 4;
    else if (type === PBF_FIXED64) this.pos += 8;
    else throw new Error(`Unimplemented type: ${type}`);
  }
  // === WRITING =================================================================
  /**
   * @param {number} tag
   * @param {number} type
   */
  writeTag(tag, type) {
    this.writeVarint(tag << 3 | type);
  }
  /** @param {number} min */
  realloc(min) {
    let length = this.length || 16;
    while (length < this.pos + min) length *= 2;
    if (length !== this.length) {
      const buf = new Uint8Array(length);
      buf.set(this.buf);
      this.buf = buf;
      this.dataView = new DataView(buf.buffer);
      this.length = length;
    }
  }
  finish() {
    this.length = this.pos;
    this.pos = 0;
    return this.buf.subarray(0, this.length);
  }
  /** @param {number} val */
  writeFixed32(val) {
    this.realloc(4);
    this.dataView.setInt32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeSFixed32(val) {
    this.realloc(4);
    this.dataView.setInt32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeFixed64(val) {
    this.realloc(8);
    this.dataView.setInt32(this.pos, val & -1, true);
    this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
    this.pos += 8;
  }
  /** @param {number} val */
  writeSFixed64(val) {
    this.realloc(8);
    this.dataView.setInt32(this.pos, val & -1, true);
    this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
    this.pos += 8;
  }
  /** @param {number} val */
  writeVarint(val) {
    val = +val || 0;
    if (val > 268435455 || val < 0) {
      writeBigVarint(val, this);
      return;
    }
    this.realloc(4);
    this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = val >>> 7 & 127;
  }
  /** @param {number} val */
  writeSVarint(val) {
    this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
  }
  /** @param {boolean} val */
  writeBoolean(val) {
    this.writeVarint(+val);
  }
  /** @param {string} str */
  writeString(str) {
    str = String(str);
    this.realloc(str.length * 4);
    this.pos++;
    const startPos = this.pos;
    this.pos = writeUtf8(this.buf, str, this.pos);
    const len = this.pos - startPos;
    if (len >= 128) makeRoomForExtraLength(startPos, len, this);
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }
  /** @param {number} val */
  writeFloat(val) {
    this.realloc(4);
    this.dataView.setFloat32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeDouble(val) {
    this.realloc(8);
    this.dataView.setFloat64(this.pos, val, true);
    this.pos += 8;
  }
  /** @param {Uint8Array} buffer */
  writeBytes(buffer) {
    const len = buffer.length;
    this.writeVarint(len);
    this.realloc(len);
    for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
  }
  /**
   * @template T
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeRawMessage(fn, obj) {
    this.pos++;
    const startPos = this.pos;
    fn(obj, this);
    const len = this.pos - startPos;
    if (len >= 128) makeRoomForExtraLength(startPos, len, this);
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }
  /**
   * @template T
   * @param {number} tag
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeMessage(tag, fn, obj) {
    this.writeTag(tag, PBF_BYTES);
    this.writeRawMessage(fn, obj);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedVarint(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSVarint(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
  }
  /**
   * @param {number} tag
   * @param {boolean[]} arr
   */
  writePackedBoolean(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFloat(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedDouble(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed32(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed32(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed64(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed64(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
  }
  /**
   * @param {number} tag
   * @param {Uint8Array} buffer
   */
  writeBytesField(tag, buffer) {
    this.writeTag(tag, PBF_BYTES);
    this.writeBytes(buffer);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed32Field(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeFixed32(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed32Field(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeSFixed32(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed64Field(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeFixed64(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed64Field(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeSFixed64(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeVarintField(tag, val) {
    this.writeTag(tag, PBF_VARINT);
    this.writeVarint(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSVarintField(tag, val) {
    this.writeTag(tag, PBF_VARINT);
    this.writeSVarint(val);
  }
  /**
   * @param {number} tag
   * @param {string} str
   */
  writeStringField(tag, str) {
    this.writeTag(tag, PBF_BYTES);
    this.writeString(str);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFloatField(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeFloat(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeDoubleField(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeDouble(val);
  }
  /**
   * @param {number} tag
   * @param {boolean} val
   */
  writeBooleanField(tag, val) {
    this.writeVarintField(tag, +val);
  }
};
function readVarintRemainder(l, s, p) {
  const buf = p.buf;
  let h, b;
  b = buf[p.pos++];
  h = (b & 112) >> 4;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 3;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 10;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 17;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 24;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 1) << 31;
  if (b < 128) return toNum(l, h, s);
  throw new Error("Expected varint not more than 10 bytes");
}
function toNum(low, high, isSigned) {
  return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
}
function writeBigVarint(val, pbf) {
  let low, high;
  if (val >= 0) {
    low = val % 4294967296 | 0;
    high = val / 4294967296 | 0;
  } else {
    low = ~(-val % 4294967296);
    high = ~(-val / 4294967296);
    if (low ^ 4294967295) {
      low = low + 1 | 0;
    } else {
      low = 0;
      high = high + 1 | 0;
    }
  }
  if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
    throw new Error("Given varint doesn't fit into 10 bytes");
  }
  pbf.realloc(10);
  writeBigVarintLow(low, high, pbf);
  writeBigVarintHigh(high, pbf);
}
function writeBigVarintLow(low, high, pbf) {
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos] = low & 127;
}
function writeBigVarintHigh(high, pbf) {
  const lsb = (high & 7) << 4;
  pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127;
}
function makeRoomForExtraLength(startPos, len, pbf) {
  const extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
  pbf.realloc(extraLen);
  for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
}
function writePackedVarint(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
function writePackedSVarint(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
function writePackedFloat(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
function writePackedDouble(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
function writePackedBoolean(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
function writePackedFixed32(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
function writePackedSFixed32(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
function writePackedFixed64(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
function writePackedSFixed64(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}
function readUtf8(buf, pos, end) {
  let str = "";
  let i = pos;
  while (i < end) {
    const b0 = buf[i];
    let c = null;
    let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
    if (i + bytesPerSequence > end) break;
    let b1, b2, b3;
    if (bytesPerSequence === 1) {
      if (b0 < 128) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 192) === 128) {
        c = (b0 & 31) << 6 | b1 & 63;
        if (c <= 127) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 192) === 128 && (b2 & 192) === 128) {
        c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
        if (c <= 2047 || c >= 55296 && c <= 57343) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
        c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        if (c <= 65535 || c >= 1114112) {
          c = null;
        }
      }
    }
    if (c === null) {
      c = 65533;
      bytesPerSequence = 1;
    } else if (c > 65535) {
      c -= 65536;
      str += String.fromCharCode(c >>> 10 & 1023 | 55296);
      c = 56320 | c & 1023;
    }
    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }
  return str;
}
function writeUtf8(buf, str, pos) {
  for (let i = 0, c, lead; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c > 55295 && c < 57344) {
      if (lead) {
        if (c < 56320) {
          buf[pos++] = 239;
          buf[pos++] = 191;
          buf[pos++] = 189;
          lead = c;
          continue;
        } else {
          c = lead - 55296 << 10 | c - 56320 | 65536;
          lead = null;
        }
      } else {
        if (c > 56319 || i + 1 === str.length) {
          buf[pos++] = 239;
          buf[pos++] = 191;
          buf[pos++] = 189;
        } else {
          lead = c;
        }
        continue;
      }
    } else if (lead) {
      buf[pos++] = 239;
      buf[pos++] = 191;
      buf[pos++] = 189;
      lead = null;
    }
    if (c < 128) {
      buf[pos++] = c;
    } else {
      if (c < 2048) {
        buf[pos++] = c >> 6 | 192;
      } else {
        if (c < 65536) {
          buf[pos++] = c >> 12 | 224;
        } else {
          buf[pos++] = c >> 18 | 240;
          buf[pos++] = c >> 12 & 63 | 128;
        }
        buf[pos++] = c >> 6 & 63 | 128;
      }
      buf[pos++] = c & 63 | 128;
    }
  }
  return pos;
}

// src/browser/crx3.ts
function readCrxFileHeader(pbf, end) {
  return pbf.readFields(
    readCrxFileHeaderField,
    {
      sha256_with_rsa: [],
      sha256_with_ecdsa: [],
      verified_contents: void 0,
      signed_header_data: void 0
    },
    end
  );
}
function readCrxFileHeaderField(tag, obj, pbf) {
  if (tag === 2) obj.sha256_with_rsa.push(readAsymmetricKeyProof(pbf, pbf.readVarint() + pbf.pos));
  else if (tag === 3)
    obj.sha256_with_ecdsa.push(readAsymmetricKeyProof(pbf, pbf.readVarint() + pbf.pos));
  else if (tag === 4) obj.verified_contents = pbf.readBytes();
  else if (tag === 1e4) obj.signed_header_data = pbf.readBytes();
}
function readAsymmetricKeyProof(pbf, end) {
  return pbf.readFields(
    readAsymmetricKeyProofField,
    { public_key: void 0, signature: void 0 },
    end
  );
}
function readAsymmetricKeyProofField(tag, obj, pbf) {
  if (tag === 1) obj.public_key = pbf.readBytes();
  else if (tag === 2) obj.signature = pbf.readBytes();
}
function readSignedData(pbf, end) {
  return pbf.readFields(readSignedDataField, { crx_id: void 0 }, end);
}
function readSignedDataField(tag, obj, pbf) {
  if (tag === 1) obj.crx_id = pbf.readBytes();
}

// src/browser/id.ts
var import_node_crypto = require("node:crypto");
function convertHexadecimalToIDAlphabet(id) {
  let result = "";
  for (const ch of id) {
    const val = parseInt(ch, 16);
    if (!isNaN(val)) {
      result += String.fromCharCode("a".charCodeAt(0) + val);
    } else {
      result += "a";
    }
  }
  return result;
}
function generateIdFromHash(hash) {
  const hashedId = hash.subarray(0, 16).toString("hex");
  return convertHexadecimalToIDAlphabet(hashedId);
}
function generateId(input) {
  const hash = (0, import_node_crypto.createHash)("sha256").update(input, "base64").digest();
  return generateIdFromHash(hash);
}

// src/browser/loader.ts
var fs = __toESM(require("node:fs"));
var path2 = __toESM(require("node:path"));
var import_debug = __toESM(require_debug());
var d = (0, import_debug.default)("electron-chrome-web-store:loader");
var manifestExists = async (dirPath) => {
  if (!dirPath) return false;
  const manifestPath = path2.join(dirPath, "manifest.json");
  try {
    return (await fs.promises.stat(manifestPath)).isFile();
  } catch {
    return false;
  }
};
async function extensionSearch(dirPath, depth = 0) {
  if (depth >= 2) return [];
  const results = [];
  const dirEntries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (entry.isDirectory()) {
      if (await manifestExists(path2.join(dirPath, entry.name))) {
        results.push(path2.join(dirPath, entry.name));
      } else {
        results.push(...await extensionSearch(path2.join(dirPath, entry.name), depth + 1));
      }
    }
  }
  return results;
}
async function discoverExtensions(extensionsPath) {
  try {
    const stat = await fs.promises.stat(extensionsPath);
    if (!stat.isDirectory()) {
      d("%s is not a directory", extensionsPath);
      return [];
    }
  } catch {
    d("%s does not exist", extensionsPath);
    return [];
  }
  const extensionDirectories = await extensionSearch(extensionsPath);
  const results = [];
  for (const extPath of extensionDirectories.filter(Boolean)) {
    try {
      const manifestPath = path2.join(extPath, "manifest.json");
      const manifestJson = (await fs.promises.readFile(manifestPath)).toString();
      const manifest = JSON.parse(manifestJson);
      const result = manifest.key ? {
        type: "store",
        path: extPath,
        manifest,
        id: generateId(manifest.key)
      } : {
        type: "unpacked",
        path: extPath,
        manifest
      };
      results.push(result);
    } catch (e) {
      console.error(e);
    }
  }
  return results;
}
function filterOutdatedExtensions(extensions) {
  const uniqueExtensions = [];
  const storeExtMap = /* @__PURE__ */ new Map();
  for (const ext of extensions) {
    if (ext.type === "unpacked") {
      uniqueExtensions.push(ext);
    } else if (!storeExtMap.has(ext.id)) {
      storeExtMap.set(ext.id, ext);
    } else {
      const latestExt = storeExtMap.get(ext.id);
      if (compareVersions(latestExt.manifest.version, ext.manifest.version) < 0) {
        storeExtMap.set(ext.id, ext);
      }
    }
  }
  storeExtMap.forEach((ext) => uniqueExtensions.push(ext));
  return uniqueExtensions;
}
async function loadAllExtensions(session, extensionsPath, options = {}) {
  const sessionExtensions = session.extensions || session;
  let extensions = await discoverExtensions(extensionsPath);
  extensions = filterOutdatedExtensions(extensions);
  d("discovered %d extension(s) in %s", extensions.length, extensionsPath);
  for (const ext of extensions) {
    try {
      let extension;
      if (ext.type === "store") {
        const existingExt = sessionExtensions.getExtension(ext.id);
        if (existingExt) {
          d("skipping loading existing extension %s", ext.id);
          continue;
        }
        d("loading extension %s", `${ext.id}@${ext.manifest.version}`);
        extension = await sessionExtensions.loadExtension(ext.path);
      } else if (options.allowUnpacked) {
        d("loading unpacked extension %s", ext.path);
        extension = await sessionExtensions.loadExtension(ext.path);
      }
      if (extension && extension.manifest.manifest_version === 3 && extension.manifest.background?.service_worker) {
        const scope = `chrome-extension://${extension.id}`;
        await session.serviceWorkers.startWorkerForScope(scope).catch(() => {
          console.error(`Failed to start worker for extension ${extension.id}`);
        });
      }
    } catch (error) {
      console.error(`Failed to load extension from ${ext.path}`);
      console.error(error);
    }
  }
}
async function findExtensionInstall(extensionId, extensionsPath) {
  const extensionPath = path2.join(extensionsPath, extensionId);
  let extensions = await discoverExtensions(extensionPath);
  extensions = filterOutdatedExtensions(extensions);
  return extensions.length > 0 ? extensions[0] : null;
}

// src/browser/installer.ts
var d2 = (0, import_debug2.default)("electron-chrome-web-store:installer");
function getExtensionCrxURL(extensionId) {
  const url = new URL("https://clients2.google.com/service/update2/crx");
  url.searchParams.append("response", "redirect");
  url.searchParams.append("acceptformat", ["crx2", "crx3"].join(","));
  const x = new URLSearchParams();
  x.append("id", extensionId);
  x.append("uc", "");
  url.searchParams.append("x", x.toString());
  url.searchParams.append("prodversion", getChromeVersion());
  return url.toString();
}
function parseCrx(buffer) {
  const magicNumber = buffer.toString("utf8", 0, 4);
  if (magicNumber !== "Cr24") {
    throw new Error("Invalid CRX format");
  }
  const version = buffer.readUInt32LE(4);
  const headerSize = buffer.readUInt32LE(8);
  const header = buffer.subarray(12, 12 + headerSize);
  const contents = buffer.subarray(12 + headerSize);
  let extensionId;
  let publicKey;
  if (version === 2) {
    const pubKeyLength = buffer.readUInt32LE(8);
    const sigLength = buffer.readUInt32LE(12);
    publicKey = buffer.subarray(16, 16 + pubKeyLength);
    extensionId = generateId(publicKey.toString("base64"));
  } else {
    const crxFileHeader = readCrxFileHeader(new Pbf(header));
    const crxSignedData = readSignedData(new Pbf(crxFileHeader.signed_header_data));
    const declaredCrxId = crxSignedData.crx_id ? convertHexadecimalToIDAlphabet(crxSignedData.crx_id.toString("hex")) : null;
    if (!declaredCrxId) {
      throw new Error("Invalid CRX signed data");
    }
    const keyProof = crxFileHeader.sha256_with_rsa.find((proof) => {
      const crxId = proof.public_key ? generateId(proof.public_key.toString("base64")) : null;
      return crxId === declaredCrxId;
    });
    if (!keyProof) {
      throw new Error("Invalid CRX key");
    }
    extensionId = declaredCrxId;
    publicKey = keyProof.public_key;
  }
  return {
    extensionId,
    version,
    header,
    contents,
    publicKey
  };
}
async function unpackCrx(crx, destPath) {
  const zip = new import_adm_zip.default(crx.contents);
  zip.extractAllTo(destPath, true);
  const manifestPath = path3.join(destPath, "manifest.json");
  const manifestContent = await fs2.promises.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestContent);
  manifest.key = crx.publicKey.toString("base64");
  await fs2.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}
async function readCrx(crxPath) {
  const crxBuffer = await fs2.promises.readFile(crxPath);
  return parseCrx(crxBuffer);
}
async function downloadCrx(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download extension");
  }
  const fileStream = fs2.createWriteStream(dest);
  const downloadStream = import_node_stream.Readable.fromWeb(response.body);
  await (0, import_promises.pipeline)(downloadStream, fileStream);
}
async function downloadExtensionFromURL(url, extensionsDir, expectedExtensionId) {
  d2("downloading %s", url);
  const installUuid = crypto.randomUUID();
  const crxPath = path3.join(os.tmpdir(), `electron-cws-download_${installUuid}.crx`);
  try {
    await downloadCrx(url, crxPath);
    const crx = await readCrx(crxPath);
    if (expectedExtensionId && expectedExtensionId !== crx.extensionId) {
      throw new Error(
        `CRX mismatches expected extension ID: ${expectedExtensionId} !== ${crx.extensionId}`
      );
    }
    const unpackedPath = path3.join(extensionsDir, crx.extensionId, installUuid);
    await fs2.promises.mkdir(unpackedPath, { recursive: true });
    let manifest = await unpackCrx(crx, unpackedPath);
    const hook = globalThis.__zeusCwsUnpacked;
    if (typeof hook === "function") manifest = await hook(unpackedPath, manifest) || manifest;
    if (!manifest.version) {
      throw new Error("Installed extension is missing manifest version");
    }
    const versionedPath = path3.join(extensionsDir, crx.extensionId, `${manifest.version}_0`);
    await fs2.promises.rename(unpackedPath, versionedPath);
    return versionedPath;
  } finally {
    await fs2.promises.rm(crxPath, { force: true });
  }
}
async function downloadExtension(extensionId, extensionsDir) {
  const url = getExtensionCrxURL(extensionId);
  return await downloadExtensionFromURL(url, extensionsDir, extensionId);
}
async function installExtension(extensionId, opts = {}) {
  d2("installing %s", extensionId);
  const session = opts.session || import_electron2.session.defaultSession;
  const sessionExtensions = session.extensions || session;
  const extensionsPath = opts.extensionsPath || getDefaultExtensionsPath();
  const existingExtension = sessionExtensions.getExtension(extensionId);
  if (existingExtension) {
    d2("%s already loaded", extensionId);
    return existingExtension;
  }
  const existingExtensionInfo = await findExtensionInstall(extensionId, extensionsPath);
  if (existingExtensionInfo && existingExtensionInfo.type === "store") {
    d2("%s already installed", extensionId);
    return await sessionExtensions.loadExtension(
      existingExtensionInfo.path,
      opts.loadExtensionOptions
    );
  }
  const extensionPath = await downloadExtension(extensionId, extensionsPath);
  const extension = await sessionExtensions.loadExtension(extensionPath, opts.loadExtensionOptions);
  d2("installed %s", extensionId);
  return extension;
}
async function uninstallExtension(extensionId, opts = {}) {
  d2("uninstalling %s", extensionId);
  const session = opts.session || import_electron2.session.defaultSession;
  const sessionExtensions = session.extensions || session;
  const extensionsPath = opts.extensionsPath || getDefaultExtensionsPath();
  const extensions = sessionExtensions.getAllExtensions();
  const existingExt = extensions.find((ext) => ext.id === extensionId);
  if (existingExt) {
    sessionExtensions.removeExtension(extensionId);
  }
  const extensionDir = path3.join(extensionsPath, extensionId);
  try {
    const stat = await fs2.promises.stat(extensionDir);
    if (stat.isDirectory()) {
      await fs2.promises.rm(extensionDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

// src/browser/api.ts
var d3 = (0, import_debug3.default)("electron-chrome-web-store:api");
var WEBSTORE_URL = "https://chromewebstore.google.com";
function getExtensionInfo(ext) {
  const manifest = ext.manifest;
  return {
    description: manifest.description || "",
    enabled: !manifest.disabled,
    homepageUrl: manifest.homepage_url || "",
    hostPermissions: manifest.host_permissions || [],
    icons: Object.entries(manifest?.icons || {}).map(([size, url]) => ({
      size: parseInt(size),
      url: `chrome://extension-icon/${ext.id}/${size}/0`
    })),
    id: ext.id,
    installType: "normal",
    isApp: !!manifest.app,
    mayDisable: true,
    name: manifest.name,
    offlineEnabled: !!manifest.offline_enabled,
    optionsUrl: manifest.options_page ? `chrome-extension://${ext.id}/${manifest.options_page}` : "",
    permissions: manifest.permissions || [],
    shortName: manifest.short_name || manifest.name,
    type: manifest.app ? "app" : "extension",
    updateUrl: manifest.update_url || "",
    version: manifest.version
  };
}
function getExtensionInstallStatus(state, extensionId, manifest) {
  if (manifest && manifest.manifest_version < state.minimumManifestVersion) {
    return ExtensionInstallStatus.DEPRECATED_MANIFEST_VERSION;
  }
  if (state.denylist?.has(extensionId)) {
    return ExtensionInstallStatus.BLOCKED_BY_POLICY;
  }
  if (state.allowlist && !state.allowlist.has(extensionId)) {
    return ExtensionInstallStatus.BLOCKED_BY_POLICY;
  }
  const sessionExtensions = state.session.extensions || state.session;
  const extensions = sessionExtensions.getAllExtensions();
  const extension = extensions.find((ext) => ext.id === extensionId);
  if (!extension) {
    return ExtensionInstallStatus.INSTALLABLE;
  }
  if (extension.manifest.disabled) {
    return ExtensionInstallStatus.DISABLED;
  }
  return ExtensionInstallStatus.ENABLED;
}
async function beginInstall({ sender, senderFrame }, state, details) {
  const extensionId = details.id;
  try {
    if (state.installing.has(extensionId)) {
      return { result: Result.INSTALL_IN_PROGRESS };
    }
    let manifest;
    try {
      manifest = JSON.parse(details.manifest);
    } catch {
      return { result: Result.MANIFEST_ERROR };
    }
    const installStatus = getExtensionInstallStatus(state, extensionId, manifest);
    switch (installStatus) {
      case ExtensionInstallStatus.INSTALLABLE:
        break;
      // good to go
      case ExtensionInstallStatus.BLOCKED_BY_POLICY:
        return { result: Result.BLOCKED_BY_POLICY };
      default: {
        d3('unable to install extension %s with status "%s"', extensionId, installStatus);
        return { result: Result.UNKNOWN_ERROR };
      }
    }
    let iconUrl;
    try {
      iconUrl = new URL(details.iconUrl);
    } catch {
      return { result: Result.INVALID_ICON_URL };
    }
    let icon;
    try {
      const response = await fetch(iconUrl.href);
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      icon = import_electron3.nativeImage.createFromBuffer(imageBuffer);
    } catch {
      return { result: Result.ICON_ERROR };
    }
    const browserWindow = import_electron3.BrowserWindow.fromWebContents(sender);
    if (!senderFrame || senderFrame.isDestroyed()) {
      return { result: Result.UNKNOWN_ERROR };
    }
    if (state.beforeInstall) {
      const result = await state.beforeInstall({
        id: extensionId,
        localizedName: details.localizedName,
        manifest,
        icon,
        frame: senderFrame,
        browserWindow: browserWindow || void 0
      });
      if (typeof result !== "object" || typeof result.action !== "string") {
        return { result: Result.UNKNOWN_ERROR };
      } else if (result.action !== "allow") {
        return { result: Result.USER_CANCELLED };
      }
    }
    state.installing.add(extensionId);
    await installExtension(extensionId, state);
    return { result: Result.SUCCESS };
  } catch (error) {
    console.error("Extension installation failed:", error);
    return {
      result: Result.INSTALL_ERROR,
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    state.installing.delete(extensionId);
  }
}
var handledIpcChannels = /* @__PURE__ */ new Map();
function registerWebStoreApi(webStoreState) {
  const handle = (channel, handle2) => {
    let handlersMap = handledIpcChannels.get(channel);
    if (!handlersMap) {
      handlersMap = /* @__PURE__ */ new Map();
      handledIpcChannels.set(channel, handlersMap);
      import_electron3.ipcMain.handle(channel, async function handleWebStoreIpc(event, ...args) {
        d3("received %s", channel);
        const senderOrigin = event.senderFrame?.origin;
        if (!senderOrigin || !senderOrigin.startsWith(WEBSTORE_URL)) {
          d3("ignoring webstore request from %s", senderOrigin);
          return;
        }
        const session = event.sender.session;
        const handler = handlersMap?.get(session);
        if (!handler) {
          d3("no handler for session %s", session.storagePath);
          return;
        }
        const result = await handler(event, ...args);
        d3("%s result", channel, result);
        return result;
      });
    }
    handlersMap.set(webStoreState.session, handle2);
  };
  handle("chromeWebstore.beginInstall", async (event, details) => {
    const { senderFrame } = event;
    d3("beginInstall", details);
    const result = await beginInstall(event, webStoreState, details);
    if (result.result === Result.SUCCESS) {
      queueMicrotask(() => {
        const sessionExtensions = webStoreState.session.extensions || webStoreState.session;
        const ext = sessionExtensions.getExtension(details.id);
        if (ext && senderFrame && !senderFrame.isDestroyed()) {
          try {
            senderFrame.send("chrome.management.onInstalled", getExtensionInfo(ext));
          } catch (error) {
            console.error(error);
          }
        }
      });
    }
    return result;
  });
  handle("chromeWebstore.completeInstall", async (event, id) => {
    return Result.SUCCESS;
  });
  handle("chromeWebstore.enableAppLauncher", async (event, enable) => {
    return true;
  });
  handle("chromeWebstore.getBrowserLogin", async () => {
    return "";
  });
  handle("chromeWebstore.getExtensionStatus", async (_event, id, manifestJson) => {
    const manifest = JSON.parse(manifestJson);
    return getExtensionInstallStatus(webStoreState, id, manifest);
  });
  handle("chromeWebstore.getFullChromeVersion", async () => {
    return {
      version_number: process.versions.chrome,
      app_name: import_electron3.app.getName()
    };
  });
  handle("chromeWebstore.getIsLauncherEnabled", async () => {
    return true;
  });
  handle("chromeWebstore.getMV2DeprecationStatus", async () => {
    return webStoreState.minimumManifestVersion > 2 ? MV2DeprecationStatus.SOFT_DISABLE : MV2DeprecationStatus.INACTIVE;
  });
  handle("chromeWebstore.getReferrerChain", async () => {
    return "EgIIAA==";
  });
  handle("chromeWebstore.getStoreLogin", async () => {
    return "";
  });
  handle("chromeWebstore.getWebGLStatus", async () => {
    await import_electron3.app.getGPUInfo("basic");
    const features = import_electron3.app.getGPUFeatureStatus();
    return features.webgl.startsWith("enabled") ? WebGlStatus.WEBGL_ALLOWED : WebGlStatus.WEBGL_BLOCKED;
  });
  handle("chromeWebstore.install", async (event, id, silentInstall) => {
    return Result.SUCCESS;
  });
  handle("chromeWebstore.isInIncognitoMode", async () => {
    return false;
  });
  handle("chromeWebstore.isPendingCustodianApproval", async (event, id) => {
    return false;
  });
  handle("chromeWebstore.setStoreLogin", async (event, login) => {
    return true;
  });
  handle("chrome.runtime.getManifest", async () => {
    return {};
  });
  handle("chrome.management.getAll", async (event) => {
    const sessionExtensions = webStoreState.session.extensions || webStoreState.session;
    const extensions = sessionExtensions.getAllExtensions();
    return extensions.map(getExtensionInfo);
  });
  handle("chrome.management.setEnabled", async (event, id, enabled) => {
    return true;
  });
  handle(
    "chrome.management.uninstall",
    async (event, id, options) => {
      if (options?.showConfirmDialog) {
      }
      try {
        await uninstallExtension(id, webStoreState);
        queueMicrotask(() => {
          event.sender.send("chrome.management.onUninstalled", id);
        });
        return Result.SUCCESS;
      } catch (error) {
        console.error(error);
        return Result.UNKNOWN_ERROR;
      }
    }
  );
}

// src/browser/updater.ts
var fs3 = __toESM(require("node:fs"));
var path4 = __toESM(require("node:path"));
var import_debug4 = __toESM(require_debug());
var import_electron4 = require("electron");
var d4 = (0, import_debug4.default)("electron-chrome-web-store:updater");
var SYSTEM_IDLE_DURATION = 1 * 60 * 60 * 1e3;
var UPDATE_CHECK_INTERVAL = 5 * 60 * 60 * 1e3;
var MIN_UPDATE_INTERVAL = 3 * 60 * 60 * 1e3;
var lastUpdateCheck;
var ALLOWED_UPDATE_URLS = /* @__PURE__ */ new Set(["https://clients2.google.com/service/update2/crx"]);
var getSessionId = /* @__PURE__ */ (() => {
  let sessionId;
  return () => sessionId || (sessionId = crypto.randomUUID());
})();
var getOmahaPlatform = () => {
  switch (process.platform) {
    case "win32":
      return "win";
    case "darwin":
      return "mac";
    default:
      return process.platform;
  }
};
var getOmahaArch = () => {
  switch (process.arch) {
    case "ia32":
      return "x86";
    case "x64":
      return "x64";
    default:
      return process.arch;
  }
};
function filterWebStoreExtension(extension) {
  const manifest = extension.manifest;
  if (!manifest) return false;
  return manifest.key && manifest.update_url && ALLOWED_UPDATE_URLS.has(manifest.update_url);
}
async function fetchAvailableUpdates(extensions) {
  if (extensions.length === 0) return [];
  const extensionIds = extensions.map((extension) => extension.id);
  const extensionMap = extensions.reduce(
    (map, ext) => ({
      ...map,
      [ext.id]: ext
    }),
    {}
  );
  const chromeVersion = getChromeVersion();
  const url = "https://update.googleapis.com/service/update2/json";
  const body = {
    request: {
      "@updater": "electron-chrome-web-store",
      acceptformat: "crx3",
      app: [
        ...extensions.map((extension) => ({
          appid: extension.id,
          updatecheck: {}
          // API always reports 'noupdate' when version is set :thinking:
          // version: extension.version,
        }))
      ],
      os: {
        platform: getOmahaPlatform(),
        arch: getOmahaArch()
      },
      prodversion: chromeVersion,
      protocol: "3.1",
      requestid: crypto.randomUUID(),
      sessionid: getSessionId(),
      testsource: process.env.NODE_ENV === "production" ? "" : "electron_dev"
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Update-Interactivity": "bg",
      "X-Goog-Update-AppId": extensionIds.join(","),
      "X-Goog-Update-Updater": `chromiumcrx-${chromeVersion}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    d4("update response not ok");
    return [];
  }
  const text = await response.text();
  const prefix = `)]}'
`;
  if (!text.startsWith(prefix)) {
    d4("unexpected update response: %s", text);
    return [];
  }
  const json = text.substring(prefix.length);
  const result = JSON.parse(json);
  let updates;
  try {
    const apps = result?.response?.app || [];
    updates = apps.filter((app5) => app5.updatecheck.status === "ok").map((app5) => {
      const extensionId = app5.appid;
      const extension = extensionMap[extensionId];
      const manifest = app5.updatecheck.manifest;
      const pkg = manifest.packages.package[0];
      return {
        extension,
        id: extensionId,
        version: manifest.version,
        name: pkg.name,
        url: app5.updatecheck.urls.url[0].codebase
      };
    }).filter((update) => {
      const extension = extensionMap[update.id];
      return compareVersions(extension.version, update.version) < 0;
    });
  } catch (error) {
    console.error("Unable to read extension updates response", error);
    return [];
  }
  return updates;
}
async function updateExtension(session, update) {
  const sessionExtensions = session.extensions || session;
  const extensionId = update.id;
  const oldExtension = update.extension;
  d4("updating %s %s -> %s", extensionId, oldExtension.version, update.version);
  const oldVersionDirectoryName = path4.basename(oldExtension.path);
  if (!oldVersionDirectoryName.startsWith(oldExtension.version)) {
    console.error(
      `updateExtension: extension ${extensionId} must conform to versioned directory names`,
      {
        oldPath: oldExtension.path
      }
    );
    d4("skipping %s update due to invalid install path %s", extensionId, oldExtension.path);
    return;
  }
  const extensionsPath = path4.join(oldExtension.path, "..", "..");
  const updatePath = await downloadExtensionFromURL(update.url, extensionsPath, extensionId);
  d4("downloaded update %s@%s", extensionId, update.version);
  if (sessionExtensions.getExtension(extensionId)) {
    sessionExtensions.removeExtension(extensionId);
    await sessionExtensions.loadExtension(updatePath);
    d4("loaded update %s@%s", extensionId, update.version);
  }
  await fs3.promises.rm(oldExtension.path, { recursive: true, force: true });
}
async function checkForUpdates(session) {
  const sessionExtensions = session.extensions || session;
  const extensions = sessionExtensions.getAllExtensions().filter(filterWebStoreExtension);
  d4("checking for updates: %s", extensions.map((ext) => `${ext.id}@${ext.version}`).join(","));
  const updates = await fetchAvailableUpdates(extensions);
  if (!updates || updates.length === 0) {
    d4("no updates found");
    return [];
  }
  return updates;
}
async function installUpdates(session, updates) {
  d4("updating %d extension(s)", updates.length);
  for (const update of updates) {
    try {
      await updateExtension(session, update);
    } catch (error) {
      console.error(`checkForUpdates: Error updating extension ${update.id}`);
      console.error(error);
    }
  }
}
async function updateExtensions(session = import_electron4.session.defaultSession) {
  const updates = await checkForUpdates(session);
  if (updates.length > 0) {
    await installUpdates(session, updates);
  }
}
async function maybeCheckForUpdates(session) {
  const idleState = import_electron4.powerMonitor.getSystemIdleState(SYSTEM_IDLE_DURATION);
  if (idleState !== "active") {
    d4('skipping update check while system is in "%s" idle state', idleState);
    return;
  }
  if (lastUpdateCheck && Date.now() - lastUpdateCheck < MIN_UPDATE_INTERVAL) {
    return;
  }
  lastUpdateCheck = Date.now();
  updateExtensions(session).catch((e) => d4('update check failed: %s', e && e.message));  // 3zT: offline is not an error
}
async function initUpdater(state) {
  const check = () => maybeCheckForUpdates(state.session);
  switch (process.platform) {
    case "darwin":
      import_electron4.app.on("did-become-active", check);
      break;
    case "win32":
    case "linux":
      import_electron4.app.on("browser-window-focus", check);
      break;
  }
  const updateIntervalId = setInterval(check, UPDATE_CHECK_INTERVAL);
  check();
  import_electron4.app.on("before-quit", (event) => {
    queueMicrotask(() => {
      if (!event.defaultPrevented) {
        d4("stopping update checks");
        clearInterval(updateIntervalId);
      }
    });
  });
}

// src/browser/index.ts
function resolvePreloadPath(modulePath) {
  try {
    return path.join(__dirname, "chrome-web-store.preload.js");
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }
  const preloadFilename = "chrome-web-store.preload.js";
  if (modulePath) {
    process.emitWarning(
      'electron-chrome-web-store: "modulePath" is deprecated and will be removed in future versions.',
      { type: "DeprecationWarning" }
    );
    return path5.join(modulePath, "dist", preloadFilename);
  }
  return path5.join(__dirname, preloadFilename);
}
async function installChromeWebStore(opts = {}) {
  const session = opts.session || import_electron5.session.defaultSession;
  const extensionsPath = opts.extensionsPath || getDefaultExtensionsPath();
  const loadExtensions = typeof opts.loadExtensions === "boolean" ? opts.loadExtensions : true;
  const allowUnpackedExtensions = typeof opts.allowUnpackedExtensions === "boolean" ? opts.allowUnpackedExtensions : false;
  const autoUpdate = typeof opts.autoUpdate === "boolean" ? opts.autoUpdate : true;
  const minimumManifestVersion = typeof opts.minimumManifestVersion === "number" ? opts.minimumManifestVersion : 3;
  const beforeInstall = typeof opts.beforeInstall === "function" ? opts.beforeInstall : void 0;
  const webStoreState = {
    session,
    extensionsPath,
    installing: /* @__PURE__ */ new Set(),
    allowlist: opts.allowlist ? new Set(opts.allowlist) : void 0,
    denylist: opts.denylist ? new Set(opts.denylist) : void 0,
    minimumManifestVersion,
    beforeInstall
  };
  const preloadPath = resolvePreloadPath(opts.modulePath);
  if ("registerPreloadScript" in session) {
    session.registerPreloadScript({
      id: "electron-chrome-web-store",
      type: "frame",
      filePath: preloadPath
    });
  } else {
    session.setPreloads([...session.getPreloads(), preloadPath]);
  }
  if (!(0, import_node_fs.existsSync)(preloadPath)) {
    console.error(
      new Error(
        `electron-chrome-web-store: Preload file not found at "${preloadPath}". See "Packaging the preload script" in the readme.`
      )
    );
  }
  registerWebStoreApi(webStoreState);
  await import_electron5.app.whenReady();
  if (loadExtensions) {
    await loadAllExtensions(session, extensionsPath, { allowUnpacked: allowUnpackedExtensions });
  }
  if (autoUpdate) {
    void initUpdater(webStoreState);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadExtension,
  installChromeWebStore,
  installExtension,
  loadAllExtensions,
  uninstallExtension,
  updateExtensions
});
