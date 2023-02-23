import { Entity } from "./entity";

export class Timebar extends Entity {
    _timebar: Entity;

    constructor(svg: HTMLElement) {
        super(svg, 'g');
        this._timebar = new Entity(svg, 'rect', super.elem);
        this._timebar.setPosition(10, 1245)
            .attr("width", 800).attr("height", 30)
            .attr('style', 'fill:#33FF00')
        const _timebar_label = new Entity(svg, 'text', super.elem);
        _timebar_label
            .attr("x", 830)
            .attr("y", 1269)
            .attr('style', 'font-size: 200%; fill: yellow;');
        _timebar_label.elem.innerHTML = "TIME";
        this.setTimePercent(1.0)
    }

    timeGoes = (step: number) => {
        this.setTimePercent(Math.max(this.getTimePercent() - step, 0))
    }

    setTimePercent = (per: number) => {
        this._timebar.setPosition(10 + 800 * (1 - per), 1245)
            .attr("width", 800 * per)
        return this
    }

    getTimePercent = () => parseFloat(this._timebar.attr("width")) / 800


}