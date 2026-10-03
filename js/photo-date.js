// PhotoDate — read the day a photo was TAKEN from its EXIF data.
// Used by the worker time entry form to sort and group attached photos by day.
// Only JPEG is parsed (DateTimeOriginal 0x9003, else DateTime 0x0132). No guess is
// made from the file's modified time: on a phone that is often the moment the photo
// was picked from the library, not the day it was shot, and a wrong day is worse
// than an honest "date not in photo".
(function() {
    function readTakenAt(file) {
        return new Promise(function(resolve) {
            if (!file || typeof file.slice !== 'function') return resolve(null);
            var reader = new FileReader();
            reader.onerror = function() { resolve(null); };
            reader.onload = function(e) {
                try { resolve(fromBuffer(e.target.result)); }
                catch (err) { resolve(null); }
            };
            reader.readAsArrayBuffer(file.slice(0, 256 * 1024));
        });
    }

    // "YYYY-MM-DDTHH:MM:SS" (camera local time) or null.
    function fromBuffer(buf) {
        var view = new DataView(buf);
        if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null; // not a JPEG
        var off = 2;
        while (off + 4 <= view.byteLength) {
            if (view.getUint8(off) !== 0xFF) return null;
            var marker = view.getUint8(off + 1);
            if (marker === 0xDA || marker === 0xD9) return null;           // image data: no EXIF
            var len = view.getUint16(off + 2);
            if (marker === 0xE1 && off + 10 <= view.byteLength && view.getUint32(off + 4) === 0x45786966) { // "Exif"
                return fromTiff(view, off + 10, Math.min(off + 2 + len, view.byteLength));
            }
            off += 2 + len;
        }
        return null;
    }

    function fromTiff(view, tiff, end) {
        if (tiff + 8 > end) return null;
        var le  = view.getUint16(tiff) === 0x4949;
        var u16 = function(p) { return view.getUint16(p, le); };
        var u32 = function(p) { return view.getUint32(p, le); };
        var original = null, modified = null;
        function ascii(p, n) {
            var s = '';
            for (var i = 0; i < n && p + i < end; i++) {
                var c = view.getUint8(p + i);
                if (!c) break;
                s += String.fromCharCode(c);
            }
            return s;
        }
        function scan(ifd, depth) {
            if (depth > 2 || ifd + 2 > end) return;
            var n = u16(ifd);
            for (var i = 0; i < n; i++) {
                var e = ifd + 2 + i * 12;
                if (e + 12 > end) return;
                var tag = u16(e), type = u16(e + 2), count = u32(e + 4);
                if (tag === 0x8769 && (type === 4 || type === 13)) { scan(tiff + u32(e + 8), depth + 1); continue; }
                if (type !== 2) continue;
                var p = count > 4 ? tiff + u32(e + 8) : e + 8;
                if (tag === 0x9003 && !original) original = ascii(p, count);
                else if (tag === 0x0132 && !modified) modified = ascii(p, count);
            }
        }
        scan(tiff + u32(tiff + 4), 0);
        var raw = original || modified;
        if (!raw) return null;
        var m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
        if (!m || m[1] === '0000') return null;
        return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
    }

    // "Friday, October 2" for a YYYY-MM-DD day, in the device's local zone.
    function dayLabel(day) {
        if (!day) return '';
        var d = new Date(day + 'T00:00:00');
        if (isNaN(d.getTime())) return day;
        return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    window.PhotoDate = { readTakenAt: readTakenAt, fromBuffer: fromBuffer, dayLabel: dayLabel };
})();
