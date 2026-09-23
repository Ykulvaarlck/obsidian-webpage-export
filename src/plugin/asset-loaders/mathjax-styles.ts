import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, Mutability } from "./asset-types.js";
import postcss from "postcss";
import safeParser from "postcss-safe-parser";

export class MathjaxStyles extends AssetLoader
{
	private mathjaxStylesheet: CSSStyleSheet | undefined = undefined;
	private lastMathjaxChanged: number = -1;
	private nodes: postcss.ChildNode[] = [];

    constructor()
    {
        super("mathjax.css", "", null, AssetType.Style, InlinePolicy.Inline, true, Mutability.Dynamic);
    }

    override async load()
    {
        // @ts-ignore
        if (this.mathjaxStylesheet == undefined) this.mathjaxStylesheet = Array.from(document.styleSheets).find((sheet) => sheet.ownerNode.id == ("MJX-CHTML-styles"));
        if (this.mathjaxStylesheet == undefined)
		{
			return;
		}

        // @ts-ignore
        const changed = this.mathjaxStylesheet?.ownerNode.getAttribute("data-change");
        if (changed != this.lastMathjaxChanged)
        {
            this.data = "";
            for (let i = 0; i < this.mathjaxStylesheet.cssRules.length; i++)
            {
                this.data += this.mathjaxStylesheet.cssRules[i].cssText + "\n";
            }
        }
        else
        {
            return;
        }

        this.lastMathjaxChanged = changed;
        await super.load();

        // the data is minified by now, so parse it instead of splitting it into lines
        this.nodes = safeParser(this.data as string).nodes;
    }

	/**
	 * Get the mathjax styles needed to render the math inside the given element.
	 * Obsidian's mathjax stylesheet is global and accumulates a rule for every glyph rendered during the session,
	 * so only keep the glyph rules for characters that appear in this element.
	 * Returns an empty string if the element contains no math.
	 */
	public getStylesFor(element: HTMLElement): string
	{
		if (!element.querySelector("mjx-container")) return "";

		const usedGlyphs = new Set<string>();
		element.querySelectorAll("mjx-c").forEach((glyph) =>
		{
			glyph.classList.forEach((cls) => { if (cls.startsWith("mjx-c")) usedGlyphs.add(cls); });
		});

		return this.nodes.filter((node) =>
		{
			if (node.type != "rule") return true;
			const glyphs = node.selector.match(/\.mjx-c[0-9A-F]+\b/g);
			if (!glyphs) return true;
			return glyphs.some((glyph) => usedGlyphs.has(glyph.slice(1)));
		}).map((node) => node.toString()).join("");
	}
}
