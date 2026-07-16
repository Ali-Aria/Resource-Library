const state = {
  resources: [],
  activeCategory: "全部",
  query: "",
  isLoading: true,
};

const PREFERRED_CATEGORIES = ["教程", "工具"];
const DEFAULT_COVER = "assets/covers/default-resource.svg";

const elements = {
  searchInput: document.querySelector("#searchInput"),
  categoryTabs: document.querySelector("#categoryTabs"),
  resourceGrid: document.querySelector("#resourceGrid"),
  resultSummary: document.querySelector("#resultSummary"),
  statePanel: document.querySelector("#statePanel"),
  stateTitle: document.querySelector("#stateTitle"),
  stateDescription: document.querySelector("#stateDescription"),
  retryButton: document.querySelector("#retryButton"),
  cardTemplate: document.querySelector("#resourceCardTemplate"),
};

init();

function init() {
  bindEvents();
  renderCategories();
  loadResources();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderResources();
  });

  elements.retryButton.addEventListener("click", loadResources);
}

async function loadResources() {
  setLoadingState();

  try {
    const response = await fetch("./data/resources.json", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`资源数据加载失败：${response.status}`);
    }

    const data = await response.json();
    state.resources = sortResourcesByDate(Array.isArray(data.resources) ? data.resources : []);
    state.isLoading = false;
    elements.searchInput.disabled = false;

    const categories = getAvailableCategories();
    if (!categories.includes(state.activeCategory)) {
      state.activeCategory = "全部";
    }

    renderCategories();
    renderResources();
  } catch (error) {
    state.resources = [];
    state.isLoading = false;
    elements.searchInput.disabled = true;
    renderCategories();
    renderErrorState();
    console.error(error);
  }
}

function setLoadingState() {
  state.isLoading = true;
  elements.searchInput.disabled = true;
  elements.resultSummary.textContent = "正在加载资料...";
  elements.statePanel.hidden = true;
  elements.retryButton.hidden = true;
  elements.resourceGrid.hidden = false;
  elements.resourceGrid.setAttribute("aria-busy", "true");

  if (!elements.resourceGrid.querySelector(".skeleton-card")) {
    renderSkeletons();
  }

  renderCategories();
}

function renderSkeletons() {
  const skeletons = Array.from({ length: 5 }, (_, index) => {
    const card = document.createElement("article");
    card.className = "resource-card skeleton-card";
    card.setAttribute("aria-hidden", "true");

    if (index === 0) {
      card.classList.add("is-featured");
    }

    const media = document.createElement("div");
    media.className = "skeleton-media";

    const body = document.createElement("div");
    body.className = "skeleton-body";

    ["skeleton-line-short", "skeleton-line-title", "", "skeleton-line-actions"].forEach(
      (className) => {
        const line = document.createElement("span");
        line.className = `skeleton-line ${className}`.trim();
        body.append(line);
      },
    );

    card.append(media, body);
    return card;
  });

  elements.resourceGrid.replaceChildren(...skeletons);
}

function renderCategories() {
  elements.categoryTabs.replaceChildren(
    ...getAvailableCategories().map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.textContent = category;
      button.disabled = state.isLoading;
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

function getAvailableCategories() {
  const discovered = new Set(state.resources.flatMap(getResourceCategories));
  const preferred = PREFERRED_CATEGORIES.filter((category) => discovered.has(category));
  const additional = Array.from(discovered)
    .filter((category) => !PREFERRED_CATEGORIES.includes(category))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));

  if (state.isLoading || state.resources.length === 0) {
    return ["全部", ...PREFERRED_CATEGORIES];
  }

  return ["全部", ...preferred, ...additional];
}

function renderResources() {
  const visibleResources = getVisibleResources();
  const keyword = state.query ? `，关键词“${state.query}”` : "";
  const category = state.activeCategory === "全部" ? "全部分类" : state.activeCategory;

  elements.resultSummary.textContent = `${category}${keyword}：共 ${visibleResources.length} 份资料`;
  elements.resourceGrid.setAttribute("aria-busy", "false");

  if (visibleResources.length === 0) {
    elements.resourceGrid.replaceChildren();
    elements.resourceGrid.hidden = true;
    showState({
      title: "没有找到匹配资料",
      description: "换个关键词，或切换到全部分类再试试。",
      canRetry: false,
    });
    return;
  }

  elements.resourceGrid.hidden = false;
  elements.statePanel.hidden = true;
  elements.resourceGrid.replaceChildren(
    ...visibleResources.map((resource, index) =>
      createResourceCard(resource, index, visibleResources.length),
    ),
  );
}

function renderErrorState() {
  elements.resultSummary.textContent = "资料数据暂时无法加载。";
  elements.resourceGrid.replaceChildren();
  elements.resourceGrid.hidden = true;
  elements.resourceGrid.setAttribute("aria-busy", "false");
  showState({
    title: "资料加载失败",
    description: "请检查网络连接，然后重新加载。",
    canRetry: true,
  });
}

function showState({ title, description, canRetry }) {
  elements.stateTitle.textContent = title;
  elements.stateDescription.textContent = description;
  elements.retryButton.hidden = !canRetry;
  elements.statePanel.hidden = false;
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

function createResourceCard(resource, index, total) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const articleUrl = getString(resource.articleUrl);
  const newBadge = card.querySelector(".new-badge");
  const coverLink = card.querySelector(".cover-link");
  const coverImage = card.querySelector(".cover-image");
  const categoryLabel = card.querySelector(".category-label");
  const time = card.querySelector("time");
  const title = card.querySelector("h2");
  const description = card.querySelector(".description");
  const tagList = card.querySelector(".tag-list");
  const actionList = card.querySelector(".action-list");

  if (index === 0 && total >= 3) {
    card.classList.add("is-featured");
  }

  if (state.resources[0] === resource) {
    card.classList.add("is-newest");
    newBadge.hidden = false;
  }

  if (articleUrl) {
    coverLink.href = articleUrl;
    coverLink.setAttribute("aria-label", `查看${getString(resource.title)}原文`);
  } else {
    const coverFrame = document.createElement("div");
    coverFrame.className = "cover-link";
    coverFrame.append(coverImage);
    coverLink.replaceWith(coverFrame);
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
  coverImage.decoding = "async";
  coverImage.loading = index === 0 ? "eager" : "lazy";

  if (index === 0) {
    coverImage.setAttribute("fetchpriority", "high");
  }

  categoryLabel.textContent = getString(resource.category) || "资料";
  time.dateTime = getString(resource.updatedAt);
  time.textContent = formatDate(resource.updatedAt);
  title.textContent = getString(resource.title);
  description.textContent = getString(resource.description);

  const tags = Array.isArray(resource.tags) ? resource.tags.filter(Boolean) : [];
  tagList.replaceChildren(...tags.map(createTag));
  actionList.replaceChildren(...createActions(resource));

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

function sortResourcesByDate(resources) {
  return resources
    .map((resource, index) => ({ resource, index }))
    .sort((left, right) => {
      const dateDiff = getDateTime(right.resource.updatedAt) - getDateTime(left.resource.updatedAt);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left.index - right.index;
    })
    .map((item) => item.resource);
}

function getDateTime(value) {
  const raw = getString(value);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).getTime();
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function createTag(tagText) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = `#${tagText}`;
  return tag;
}

function createActions(resource) {
  const actions = [];
  const articleUrl = getString(resource.articleUrl);
  const baiduUrl = getString(resource.baiduUrl);
  const quarkUrl = getString(resource.quarkUrl);
  let hasPrimaryAction = false;

  const addLink = (href, text) => {
    if (!href) {
      return;
    }

    actions.push(createActionLink(href, text, !hasPrimaryAction));
    hasPrimaryAction = true;
  };

  addLink(articleUrl, "公众号原文");
  addLink(baiduUrl, "百度网盘");
  addLink(quarkUrl, "夸克网盘");
  return actions;
}

function createActionLink(href, text, isPrimary) {
  const link = document.createElement("a");
  link.className = `action-button ${isPrimary ? "is-primary" : "is-secondary"}`;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
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
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}
