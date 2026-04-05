const API = "https://escape-group.vercel.app/api";
const DAYS = ["日", "一", "二", "三", "四", "五", "六"];
const LOCATIONS = {
  北部: {
    keelung: "基隆",
    taipei: "台北",
    new_taipei: "新北",
    taoyuan: "桃園",
    hsinchu: "新竹",
    miaoli: "苗栗",
  },
  中部: {
    taichung: "台中",
    changhua: "彰化",
    nantou: "南投",
    yunlin: "雲林",
    chiayi: "嘉義",
  },
  南部: { tainan: "台南", kaohsiung: "高雄", pingtung: "屏東" },
  "東部+離島": {
    yilan: "宜蘭",
    hualien: "花蓮",
    taitung: "台東",
    penghu: "澎湖",
    kinmen: "金門",
    matsu: "馬祖",
  },
};
const ALL_LOC = Object.values(LOCATIONS).reduce((a, r) => ({ ...a, ...r }), {});

function fmtDate(d) {
  if (!d) return "";
  var dt = new Date(d);
  return (
    dt.getMonth() +
    1 +
    "/" +
    dt.getDate() +
    "(" +
    DAYS[dt.getDay()] +
    ") " +
    dt.getHours().toString().padStart(2, "0") +
    ":" +
    dt.getMinutes().toString().padStart(2, "0")
  );
}

function esc(s) {
  if (!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function toast(msg) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(function () {
    el.classList.remove("show");
  }, 2000);
}

// Fetch with LIFF access token in Authorization header.
// Requires liff.init() to have been called and user logged in.
async function authedFetch(url, options) {
  options = options || {};
  const headers = new Headers(options.headers || {});
  const token = liff.getAccessToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, Object.assign({}, options, { headers }));
}
