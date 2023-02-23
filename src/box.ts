import { Entity } from "./entity";

export class Box extends Entity {

    private rememberState = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    }

    private renderState = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    }

    constructor(svg: HTMLElement, state: {
        x: number,
        y: number,
        width: number,
        height: number,
    } = { x: 0, y: 0, width: 100, height: 60 }, fillColor = "yellow") {
        super(svg, "rect")
        this.rememberState = state
        this.renderState = state
        this.attr("style", "fill: " + fillColor + ";")
        this.render()
    }

    render = () => {
        this.attr("width", this.renderState.width)
        this.attr("height", this.renderState.height)
        this.attr("x", this.renderState.x)
        this.attr("y", this.renderState.y)
    }

    // getter & setter
    get x() {
        return this.rememberState.x
    }
    set x(value: number) {
        this.rememberState.x = value
        this.render()
    }

    get y() {
        return this.rememberState.y
    }
    set y(value: number) {
        this.rememberState.y = value
        this.render()
    }

    show = () => {
        // copy the object, not the reference
        this.renderState = { ...this.rememberState }
        this.render()
    }

    hide = () => {
        this.renderState = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        }
        this.render()
    }

}