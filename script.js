const state = {
  resources: [],
  activeCategory: "全部",
  query: "",
};

const FIXED_CATEGORIES = ["全部", "教程", "工具"];
const DEFAULT_COVER = "assets/covers/default-resource.svg";

const elements = {
  searchInput: document.querySelector("#searchInput"),
  categoryTabs: document.querySelector("#categoryTabs"),
  resourceGrid: document.querySelector("#resourceGrid"),
  resultSummary: document.querySelector("#resultSummary"),
  emptyState: document.querySelector("#emptyState"),
  cardTemplate: document.querySelector("#resourceCardTemplate"),
};

const icons = {
  article:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h7l3 3v13H7z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2"/><path d="M14 4v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/></svg>',
  cloud:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .7-8.55A6.2 6.2 0 0 0 5.7 8.4 5.1 5.1 0 0 0 7.5 18.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.1L19 10l-5.2 1.9L12 17l-1.8-5.1L5 10l5.2-1.9L12 3ZM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" fill="currentColor"/></svg>',
};

init();

async function init() {
  try {
    const response = await fetch("./data/resources.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`资源数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.resources = Array.isArray(data.resources) ? data.resources : [];

    renderCategories();
    renderResources();
    bindEvents();
  } catch (error) {
    elements.resultSummary.textContent = "资料数据暂时无法加载，请稍后刷新。";
    elements.emptyState.hidden = false;
    console.error(error);
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderResources();
  });
}

function renderCategories() {
  elements.categoryTabs.replaceChildren(
    ...FIXED_CATEGORIES.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === state.activeCategory));

      if (category === state.activeCategory) {
        button.classList.add("is-active");
      }

      button.addEventListener("click", () => {
        state.activeCategory = category;
        renderCategories();
        renderResources();
      });

      return button;
    }),
  );
}

function renderResources() {
  const visibleResources = getVisibleResources();
  const keyword = state.query ? `，关键词“${state.query}”` : "";
  const category = state.activeCategory === "全部" ? "全部分类" : state.activeCategory;

  elements.resultSummary.textContent = `${category}${keyword}：共 ${visibleResources.length} 份资料`;
  elements.resourceGrid.replaceChildren(...visibleResources.map(createResourceCard));
  elements.emptyState.hidden = visibleResources.length > 0;
}

function getVisibleResources() {
  const query = normalizeText(state.query);

  return state.resources.filter((resource) => {
    const inCategory =
      state.activeCategory === "全部" || getResourceCategories(resource).includes(state.activeCategory);

    if (!inCategory) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchableText = normalizeText(
      [
        resource.title,
        resource.description,
        resource.category,
        ...getResourceCategories(resource),
        ...(Array.isArray(resource.tags) ? resource.tags : []),
      ].join(" "),
    );

    return searchableText.includes(query);
  });
}

function createResourceCard(resource) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const articleUrl = getString(resource.articleUrl);
  const coverLink = card.querySelector(".cover-link");
  const coverImage = card.querySelector(".cover-image");
  const categoryLabel = card.querySelector(".category-label");
  const time = card.querySelector("time");
  const title = card.querySelector("h2");
  const description = card.querySelector(".description");
  const tagList = card.querySelector(".tag-list");
  const actionList = card.querySelector(".action-list");

  if (articleUrl) {
    coverLink.href = articleUrl;
  } else {
    coverLink.removeAttribute("target");
    coverLink.removeAttribute("rel");
    coverLink.setAttribute("aria-disabled", "true");
  }

  coverImage.addEventListener(
    "error",
    () => {
      coverImage.src = DEFAULT_COVER;
    },
    { once: true },
  );
  coverImage.src = getString(resource.cover) || DEFAULT_COVER;
  coverImage.alt = `${getString(resource.title)}封面`;
  categoryLabel.textContent = getString(resource.category) || "资料";
  time.dateTime = getString(resource.updatedAt);
  time.textContent = formatDate(resource.updatedAt);
  title.textContent = getString(resource.title);
  description.textContent = getString(resource.description);

  const tags = Array.isArray(resource.tags) ? resource.tags.filter(Boolean) : [];
  tagList.replaceChildren(...tags.map(createTag));

  const actions = createActions(resource);
  actionList.replaceChildren(...actions);

  return card;
}

function getResourceCategories(resource) {
  if (Array.isArray(resource.categories)) {
    return resource.categories.map(getString).filter(Boolean);
  }

  return getString(resource.category)
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createTag(tagText) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = `# ${tagText}`;
  return tag;
}

function createActions(resource) {
  const actions = [];
  const articleUrl = getString(resource.articleUrl);
  const baiduUrl = getString(resource.baiduUrl);
  const baiduCode = getString(resource.baiduCode);
  const quarkUrl = getString(resource.quarkUrl);

  if (articleUrl) {
    actions.push(createActionLink(articleUrl, "公众号原文", "action-article", icons.article));
  }

  if (baiduUrl) {
    actions.push(createActionLink(baiduUrl, "百度网盘", "action-baidu", icons.cloud));

    if (baiduCode) {
      const code = document.createElement("span");
      code.className = "extract-code";
      code.textContent = `提取码 ${baiduCode}`;
      actions.push(code);
    }
  }

  if (quarkUrl) {
    actions.push(createActionLink(quarkUrl, "夸克网盘", "action-quark", icons.spark));
  }

  return actions;
}

function createActionLink(href, text, variantClass, icon) {
  const link = document.createElement("a");
  link.className = `action-button ${variantClass}`;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.innerHTML = `${icon}<span>${text}</span>`;
  return link;
}

function formatDate(value) {
  const raw = getString(value);

  if (!raw) {
    return "最近更新";
  }

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    return `${dateOnly[1]}.${dateOnly[2]}.${dateOnly[3]}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
