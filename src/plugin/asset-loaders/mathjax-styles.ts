import { AssetLoader } from "./base-asset.js";
import { AssetType, InlinePolicy, Mutability } from "./asset-types.js";
import postcss from "postcss";
import safeParser from "postcss-safe-parser";

export class MathjaxStyles extends AssetLoader
{
	private mathjaxStylesheet: CSSStyleSheet | undefined = undefined;
	private lastMathjaxChanged: number = -1;
	private nodes: postcss.ChildNode[] = [];
	private usedFontFamilies: Set<string> = new Set();

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
	 * If separateFonts is true, the @font-face rules are left out and the fonts this element needs are remembered for getUsedFontFaces().
	 */
	public getStylesFor(element: HTMLElement, separateFonts: boolean = false): string
	{
		if (!element.querySelector("mjx-container")) return "";

		const usedGlyphs = new Set<string>();
		element.querySelectorAll("mjx-c").forEach((glyph) =>
		{
			glyph.classList.forEach((cls) => { if (cls.startsWith("mjx-c")) usedGlyphs.add(cls); });
		});

		let nodes = this.nodes.filter((node) =>
		{
			if (node.type != "rule") return true;
			const glyphs = node.selector.match(/\.mjx-c[0-9A-F]+\b/g);
			if (!glyphs) return true;
			return glyphs.some((glyph) => usedGlyphs.has(glyph.slice(1)));
		});

		if (separateFonts)
		{
			nodes = nodes.filter((node) => !MathjaxStyles.isFontFace(node));

			// remember the font families of rules that apply to something in this element, e.g. ".TEX-I { font-family: MJXZERO, MJXTEX-I }"
			for (const node of nodes)
			{
				if (node.type != "rule") continue;
				node.walkDecls("font-family", (decl) =>
				{
					if (!MathjaxStyles.selectorMatches(element, node.selector)) return;
					decl.value.split(",").forEach((family) => this.usedFontFamilies.add(MathjaxStyles.cleanFamily(family)));
				});
			}
		}

		return nodes.map((node) => node.toString()).join("");
	}

	/**
	 * Get the @font-face rules for the fonts needed by the elements passed to getStylesFor() with separateFonts since the last resetUsedFonts().
	 */
	public getUsedFontFaces(): string
	{
		return this.nodes.filter((node) =>
		{
			if (!MathjaxStyles.isFontFace(node)) return false;
			let used = false;
			(node as postcss.AtRule).walkDecls("font-family", (decl) => { if (this.usedFontFamilies.has(MathjaxStyles.cleanFamily(decl.value))) used = true; });
			return used;
		}).map((node) => node.toString()).join("");
	}

	public resetUsedFonts()
	{
		this.usedFontFamilies.clear();
	}

	private static isFontFace(node: postcss.ChildNode): boolean
	{
		return node.type == "atrule" && node.name == "font-face";
	}

	private static cleanFamily(family: string): string
	{
		return family.trim().replace(/^["']|["']$/g, "");
	}

	private static selectorMatches(element: HTMLElement, selector: string): boolean
	{
		try
		{
			return element.querySelector(selector.replace(/::?(before|after)\b/g, "")) != null;
		}
		catch
		{
			return true; // keep the font if the selector can't be checked
		}
	}
}
