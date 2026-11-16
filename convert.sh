#!/usr/bin/env bash
# ভিডিও নিউজ: ফোন যে ভিডিও পড়তে পারে না (HEVC ইত্যাদি) — H.264 MP4-এ বদলে সাইটে ফেরত
set -u
B="https://photocardbd.com/news-card/vn-convert"
H=(-H "X-Robot-Key: $DC_ROBOT_KEY" -A "Mozilla/5.0 PhotoCardBD-Robot")
command -v ffmpeg >/dev/null || { sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg; }
for round in 1 2 3 4 5 6; do
  ids=$(curl -s -L -m 30 "${H[@]}" "$B?robot=list" | tr -dc '0-9,')
  if [ -z "$ids" ]; then [ "$round" -ge 2 ] && break; sleep 20; continue; fi
  for id in ${ids//,/ }; do
    echo "== ভিডিও #$id"
    rm -f src.bin out.mp4 part_*
    if ! curl -s -L -f -m 900 "${H[@]}" -o src.bin "$B?robot=src&id=$id"; then
      curl -s -L -m 30 "${H[@]}" "$B?robot=fail&id=$id&msg=download" >/dev/null; continue; fi
    # লম্বা দিক সর্বোচ্চ ১৯২০, জোড় মাপ, ৩০fps-এর বেশি নয়, ফোন-বান্ধব H.264 + AAC
    if ! ffmpeg -nostdin -y -v error -i src.bin -map 0:v:0 -map '0:a:0?' \
        -vf "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'" -fpsmax 30 \
        -c:v libx264 -preset veryfast -crf 24 -maxrate 5M -bufsize 10M -pix_fmt yuv420p -profile:v high \
        -c:a aac -b:a 128k -ac 2 -movflags +faststart out.mp4; then
      curl -s -L -m 30 "${H[@]}" "$B?robot=fail&id=$id&msg=ffmpeg" >/dev/null; continue; fi
    ls -la out.mp4
    split -b 4000000 -d -a 3 out.mp4 part_
    i=0; ok=1
    for p in part_*; do
      curl -s -L -f -m 300 "${H[@]}" -H "Content-Type: application/octet-stream" --data-binary "@$p" "$B?robot=put&id=$id&i=$i" >/dev/null || { ok=0; break; }
      i=$((i+1))
    done
    if [ $ok = 1 ]; then curl -s -L -m 30 "${H[@]}" "$B?robot=done&id=$id"; echo; else curl -s -L -m 30 "${H[@]}" "$B?robot=fail&id=$id&msg=upload" >/dev/null; fi
  done
done
