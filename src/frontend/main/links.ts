import { FilePreviewPopover } from "./link-preview";

export class LinkHandler
{

	public static initializeLinks(onElement: HTMLElement)
	{
		console.log("Initializing links on element", onElement);
		onElement?.querySelectorAll(".internal-link, a.tag, a.tree-item-self, a.footnote-link").forEach(function(link: HTMLElement)
		{
			const target = LinkHandler.getLinkTarget(link) ?? "null";

			if(target == "null")
			{
				console.log("No target found for link");
				return;
			}

			// in a local file the href points to a file that doesn't exist, so point it at the page's url hash instead (see getLocalRouteHash).
			// the browser can then open it in a new tab, copy it, etc. the original target is kept in data-wpe-href.
			if (!ObsidianSite.isHttp && !target.startsWith("#") && !target.startsWith("?") && !target.startsWith("http"))
			{
				const pathname = LinkHandler.getPathnameFromURL(target);
				link.setAttribute("data-wpe-href", target);
				link.setAttribute("href", ObsidianSite.getLocalRouteHash(pathname, LinkHandler.getHashFromURL(target)));
			}

			link.addEventListener("click", function(event)
			{
				// ctrl/cmd/shift click opens the link in a new tab or window, let the browser handle it (middle click doesn't fire click)
				if (event.ctrlKey || event.metaKey || event.shiftKey) return;

				event.preventDefault();
				event.stopPropagation();
				ObsidianSite.loadURL(target);

				// Close the sidebar containing this link on phone
				if (ObsidianSite.deviceSize === "phone")
				{
					// Find which sidebar contains this link
					const leftSidebar = link.closest("#left-sidebar");
					const rightSidebar = link.closest("#right-sidebar");

					if (leftSidebar && ObsidianSite.leftSidebar?.collapsed === false)
					{
						ObsidianSite.leftSidebar.collapsed = true;
					}
					else if (rightSidebar && ObsidianSite.rightSidebar?.collapsed === false)
					{
						ObsidianSite.rightSidebar.collapsed = true;
					}
				}
			});

			// if the link doesn't point to a valid document in ObsidianSite set it to unresolved
			if(target && !target.startsWith("http") && !ObsidianSite.documentExists(target))
			{
				link.classList.add("is-unresolved");
			}
			else if (link.classList.contains("internal-link"))
			{
				// Only initialize link preview if the feature is enabled
				if (!ObsidianSite.metadata?.ignoreMetadata && 
					ObsidianSite.metadata?.featureOptions?.linkPreview?.enabled)
				{
					FilePreviewPopover.initializeLink(link, target);
				}
			}
		});
	}

	/** The link's original target, even after its href was changed to a url hash by initializeLinks */
	public static getLinkTarget(link: Element): string | null
	{
		return link.getAttribute("data-wpe-href") ?? link.getAttribute("href");
	}

	public static getPathnameFromURL(url: string): string
	{
		if(url == "" || url == "/" || url == "\\") return "index.html";
		if(url?.startsWith("#") || url?.startsWith("?")) return (ObsidianSite.document?.pathname?.split("#")[0]?.split("?")[0] ?? "") + (url ?? "");
		return url?.split("?")[0]?.split("#")[0]?.trim() ?? "";
	}

	public static getHashFromURL(url: string): string
	{
		return (url.split("#")[1] ?? "").split("?")[0]?.trim() ?? "";
	}

	public static getQueryFromURL(url: string): string
	{
		return url.split("?")[1]?.trim() ?? "";
	}

	public static getFileDataIdFromURL(url: string): string
	{
		url = this.getPathnameFromURL(url);
		if (url.startsWith("./")) url = url.substring(2);
		while (url.startsWith("../")) {
			url = url.substring(3);
		}
		return btoa(encodeURI(url));
	}
}
