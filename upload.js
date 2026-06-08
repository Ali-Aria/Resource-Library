const RESOURCE_URL = "./data/resources.json";
const DEFAULT_COVER = "assets/covers/default-resource.svg";

const dataStore = {
  resources: [],
};

const form = document.querySelector("#resourceForm");
const jsonStatus = document.querySelector("#jsonStatus");
const resourceCount = document.querySelector("#resourceCount");
const actionStatus = document.querySelector("#actionStatus");
const previewCard = document.querySelector("#previewCard");
const jsonOutput = document.querySelector("#jsonOutput");
const downloadJsonButton = document.querySelector("#downloadJson");
const copyJsonButton = document.querySelector("#copyJson");
const clearFormButton = document.querySelector("#clearForm");

init();

async function init() {
  setDefaultDate();
  bindEvents();
  await loadResources();
  renderAll();
}

function bindEvents() {
  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);
  form.addEventListener("submit", handleSubmit);
  downloadJsonButton.addEventListener("click", downloadJson);
  copyJsonButton.addEventListener("click", copyJson);
  clearFormButton.addEventListener("click", clearForm);
}

async function loadResources() {
  try {
    const response = await fetch(RESOURCE_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    dataStore.resources = Array.isArray(data.resources) ? data.resources : [];
    jsonStatus.textContent = "已读取当前资料库。";
  } catch (error) {
    dataStore.resources = [];
    jsonStatus.textContent = "未读取到当前资料库，将从空列表开始。";
    console.warn(error);
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const resource = getFormResource();
  const validation = validateResource(resource);

  if (validation) {
    setStatus(validation, true);
    return;
  }

  resource.id = makeUniqueId(resource.id);
  dataStore.resources.unshift(resource);
  renderAll();
  setStatus(`已添加：${resource.title}`);
  form.reset();
  setDefaultDate();
  renderPreview();
}

function getFormResource() {
  const formData = new FormData(form);
  const categories = formData.getAll("categories").map(cleanText).filter(Boolean);
  const title = cleanText(formData.get("title"));
  const tags = splitTags(formData.get("tags"));

  return {
    id: slugify(title),
    title,
    description: cleanText(formData.get("description")),
    category: categories.join("、"),
    categories,
    tags,
    updatedAt: cleanText(formData.get("updatedAt")),
    cover: cleanText(formData.get("cover")) || DEFAULT_COVER,
    articleUrl: cleanText(formData.get("articleUrl")),
    baiduUrl: cleanText(formData.get("baiduUrl")),
    baiduCode: cleanText(formData.get("baiduCode")),
    quarkUrl: cleanText(formData.get("quarkUrl")),
  };
}

function validateResource(resource) {
  if (!resource.title) {
    return "请填写资料名。";
  }

  if (!resource.description) {
    return "请填写一句话简介。";
  }

  if (!resource.categories.length) {
    return "请选择至少一个分类。";
  }

  if (!resource.updatedAt) {
    return "请选择更新时间。";
  }

  return "";
}

function renderAll() {
  renderJson();
  renderPreview();
}

function renderJson() {
  resourceCount.textContent = `${dataStore.resources.length} 条`;
  jsonOutput.value = JSON.stringify({ resources: dataStore.resources }, null, 2);
}

function renderPreview() {
  const resource = getFormResource();
  const title = resource.title || "资料名";
  const description = resource.description || "一句话简介会显示在这里。";
  const category = resource.category || "教程";
  const tags = resource.tags.length ? resource.tags : ["标签"];
  const updatedAt = formatDate(resource.updatedAt);

  previewCard.innerHTML = `
    <a class="cover-link" href="${escapeAttr(resource.articleUrl || "#")}" target="_blank" rel="noopener noreferrer">
      <img class="cover-image" src="${escapeAttr(resource.cover)}" alt="${escapeAttr(title)}封面" loading="lazy" />
    </a>
    <div class="card-body">
      <div class="card-meta">
        <span class="category-label">${escapeHTML(category)}</span>
        <time>${escapeHTML(updatedAt)}</time>
      </div>
      <h2>${escapeHTML(title)}</h2>
      <p class="description">${escapeHTML(description)}</p>
      <div class="tag-list" aria-label="标签">
        ${tags.map((tag) => `<span class="tag"># ${escapeHTML(tag)}</span>`).join("")}
      </div>
      <div class="action-list">
        ${resource.articleUrl ? actionLink("公众号原文", "action-article") : ""}
        ${resource.baiduUrl ? actionLink("百度网盘", "action-baidu") : ""}
        ${resource.baiduCode ? `<span class="extract-code">提取码 ${escapeHTML(resource.baiduCode)}</span>` : ""}
        ${resource.quarkUrl ? actionLink("夸克网盘", "action-quark") : ""}
      </div>
    </div>
  `;

  const image = previewCard.querySelector(".cover-image");
  image.addEventListener(
    "error",
    () => {
      image.src = DEFAULT_COVER;
    },
    { once: true },
  );
}

function actionLink(text, className) {
  return `<span class="action-button ${className}">${escapeHTML(text)}</span>`;
}

async function copyJson() {
  const text = jsonOutput.value;

  try {
    await navigator.clipboard.writeText(text);
    setStatus("JSON 已复制。");
  } catch {
    jsonOutput.select();
    document.execCommand("copy");
    setStatus("JSON 已复制。");
  }
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "resources.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("已生成 resources.json 下载文件。");
}

function clearForm() {
  form.reset();
  setDefaultDate();
  renderPreview();
  setStatus("表单已清空。");
}

function setDefaultDate() {
  const dateInput = form.elements.updatedAt;
  if (!dateInput.value) {
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    dateInput.value = localDate.toISOString().slice(0, 10);
  }
}

function setStatus(message, isError = false) {
  actionStatus.textContent = message;
  actionStatus.classList.toggle("is-error", isError);
}

function makeUniqueId(baseId) {
  const ids = new Set(dataStore.resources.map((resource) => resource.id));
  const fallback = `resource-${Date.now()}`;
  const base = baseId || fallback;

  if (!ids.has(base)) {
    return base;
  }

  let index = 2;
  let nextId = `${base}-${index}`;

  while (ids.has(nextId)) {
    index += 1;
    nextId = `${base}-${index}`;
  }

  return nextId;
}

function splitTags(value) {
  return Array.from(
    new Set(
      cleanText(value)
        .split(/[、,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function slugify(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `resource-${Date.now()}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  const raw = cleanText(value);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    return `${dateOnly[1]}.${dateOnly[2]}.${dateOnly[3]}`;
  }

  return raw || "最近更新";
}

function escapeHTML(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
