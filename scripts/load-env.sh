# Nạp .env.local vào môi trường (dùng chung cho các script). Biến đã có sẵn trên dòng lệnh được ưu tiên.
# Bỏ dòng trống/chú thích, dấu nháy và \r (file sửa trên Windows).
load_env_local() {
  local file="$1"
  [ -f "$file" ] || return 0
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
    val="${val#\"}"; val="${val%\"}"; val="${val#\'}"; val="${val%\'}"
    if [ -z "${!key+x}" ]; then export "$key=$val"; fi
  done < "$file"
  return 0
}
