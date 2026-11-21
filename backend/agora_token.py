"""
Agora AccessToken2 generator — matches the official Agora Python SDK.

Source of truth:
  https://github.com/AgoraIO/Tools/blob/master/DynamicKey/AgoraDynamicKey/python3/src/AccessToken2.py

Critical layout rules (easy to get wrong):
  • Little-endian packing throughout
  • Signing key derivation: hmac(issue_ts, cert) then hmac(salt, that)  — key FIRST
  • RTC service pack order: type → privileges → channel → uid
  • Final payload: signature FIRST, then signing_info  (then zlib + base64 + "007")
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import random
import struct
import time
import zlib


PRIVILEGE_JOIN_CHANNEL = 1
PRIVILEGE_PUBLISH_AUDIO = 2
PRIVILEGE_PUBLISH_VIDEO = 3
PRIVILEGE_PUBLISH_DATA = 4
SERVICE_TYPE_RTC = 1


def _pack_uint16(x: int) -> bytes:
    return struct.pack("<H", x)


def _pack_uint32(x: int) -> bytes:
    return struct.pack("<I", x)


def _pack_string(data: str | bytes) -> bytes:
    b = data.encode("utf-8") if isinstance(data, str) else data
    return _pack_uint16(len(b)) + b


def _pack_map_uint32(m: dict[int, int]) -> bytes:
    buf = _pack_uint16(len(m))
    for k, v in sorted(m.items(), key=lambda item: int(item[0])):
        buf += _pack_uint16(k) + _pack_uint32(v)
    return buf


def generate_rtc_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int,
    expiration_seconds: int = 3600,
) -> str:
    """
    Generate an Agora RTC AccessToken2 (007…) for channel + uid.
    """
    issue_ts = int(time.time())
    expire = expiration_seconds  # relative lifetime of the token
    salt = random.randint(1, 99_999_999)
    privilege_expire = issue_ts + expiration_seconds

    privileges: dict[int, int] = {
        PRIVILEGE_JOIN_CHANNEL: privilege_expire,
        PRIVILEGE_PUBLISH_AUDIO: privilege_expire,
        PRIVILEGE_PUBLISH_VIDEO: privilege_expire,
        PRIVILEGE_PUBLISH_DATA: privilege_expire,
    }

    uid_str = "" if uid == 0 else str(uid)

    # signing_info = header + services
    signing_info = (
        _pack_string(app_id)
        + _pack_uint32(issue_ts)
        + _pack_uint32(expire)
        + _pack_uint32(salt)
        + _pack_uint16(1)  # one service
        # ServiceRtc.pack(): type + privileges + channel + uid
        + _pack_uint16(SERVICE_TYPE_RTC)
        + _pack_map_uint32(privileges)
        + _pack_string(channel_name)
        + _pack_string(uid_str)
    )

    # Derive signing key — KEY is issue_ts/salt, MESSAGE is cert/prior digest
    # (matches AccessToken.__signing in the official SDK)
    cert_bytes = app_certificate.encode("utf-8")
    signing = hmac.new(_pack_uint32(issue_ts), cert_bytes, hashlib.sha256).digest()
    signing = hmac.new(_pack_uint32(salt), signing, hashlib.sha256).digest()

    signature = hmac.new(signing, signing_info, hashlib.sha256).digest()

    # Final: signature FIRST, then signing_info
    content = _pack_string(signature) + signing_info
    return "007" + base64.b64encode(zlib.compress(content)).decode("utf-8")
