import { Entity } from "./entity";

export class Frogger extends Entity {

    constructor(svg: HTMLElement, state: {
        raduis: number,
        x: number,
        y: number,
        hide?: boolean
    }) {
        super(svg, 'circle');
        this.attr("r", state.raduis)
        this.attr("cx", state.x)
        this.attr("cy", state.y)
        this.attr(
            "style",
            "fill: green; stroke: green; stroke-width: 1px;"
        );
        if (state.hide) {
            this.hide()
        }
    }

    show = () => {
        this.attr(
            "style",
            "fill: green; stroke: green; stroke-width: 1px;"
        );
    }

    hide = () => {
        this.attr("style", "fill: #00004d;")
    }
}