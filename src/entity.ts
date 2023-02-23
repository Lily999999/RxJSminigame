export class Entity {
    elem: Element;
  
    constructor(svg: HTMLElement, tag: string, parent: Element = svg) {
      this.elem = document.createElementNS(svg.namespaceURI, tag);
      parent.appendChild(this.elem);
    }
  
    attr(name: string): string
    attr(name: string, value: string | number): this
    attr(name: string, value?: string | number): this | string {
      if (typeof value === 'undefined') {
        return this.elem.getAttribute(name)!;
      }
      this.elem.setAttribute(name, value.toString());
      return this;
    }
  
    setPosition = (x: number, y: number): this =>
      this.attr("transform", `translate(${x} ${y})`);
  
  }
  
  export interface Flowable {
    getX: () => number
    getY: () => number
    reset(): Flowable
    flow(step: number): void
  }