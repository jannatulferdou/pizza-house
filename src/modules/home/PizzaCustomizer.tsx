import { T } from "../../app/Locale";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { money } from "../../shared/commerce";
import { configuredPrice, configurationLabel, defaultPizza, } from "../../shared/pizza-options";
import type { PizzaConfiguration } from "../../shared/types";
import { PizzaOptions, ConfiguredPhoto } from "../catalog/PizzaOptions";
const PizzaScene = lazy(() => import("./PizzaScene"));
export function PizzaCustomizer({ paused }: {
    paused: boolean;
}) {
    const { products, add } = useStore();
    const product = products.find((p) => p.id === "pizza");
    const [options, setOptions] = useState<PizzaConfiguration>(defaultPizza);
    const [visible, setVisible] = useState(false);
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!host.current)
            return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: "200px" });
        observer.observe(host.current);
        return () => observer.disconnect();
    }, []);
    if (!product)
        return null;
    const preview = (<ConfiguredPhoto src={product.image} name={product.name} value={options}/>);
    return (<section className="pizza-studio" id="pizza-studio" aria-labelledby="studio-title">
      <div className="studio-heading">
        <span className="eyebrow"><T space>{"THE PIZZA STUDIO / YOUR GOOD TASTE"}</T></span>
        <h2 id="studio-title"><T space>{"A house original."}</T><br />
          <em><T space>{"With your signature."}</T></em>
        </h2>
        <p><T space>{"Start with our margherita. Make the rest your own."}</T></p>
      </div>
      <div className="studio-layout">
        <div className="studio-visual" ref={host}>
          <div className="studio-orbit" aria-hidden="true"/>
          <span className="studio-note"><T space>{"A LITTLE MORE YOU."}</T></span>
          <T>{visible ? (<Suspense fallback={preview}>
              <PizzaScene customize options={options} paused={paused}/>
            </Suspense>) : (preview)}</T>
          <span className="studio-size">
            <T>{options.size === "large" ? "14″" : "12″"}</T>
            <small>
              <T>{options.crust === "thin"
        ? "THIN & CRISP"
        : options.crust === "cheese"
            ? "CHEESE-STUFFED"
            : "CLASSIC CRUST"}</T>
            </small>
          </span>
          <p className="studio-caption"><T space>{"Interactive 3D illustration \u00B7 ingredients shown for inspiration"}</T></p>
        </div>
        <div className="studio-controls">
          <PizzaOptions value={options} onChange={setOptions}/>
          <p className="studio-selection" aria-live="polite">
            <T>{configurationLabel(options)}</T>
          </p>
          <div className="studio-total">
            <span><T space>{"Your creation"}</T><small><T space>{"Base pizza"}</T><T>{money(product.price)}</T></small>
            </span>
            <strong aria-live="polite">
              <T>{money(configuredPrice(product, options))}</T>
            </strong>
          </div>
          <button className="pill dark" disabled={!product.stock} onClick={() => add(product.id, 1, options)}>
            <T>{product.stock ? "Make this one mine" : "Currently sold out"}</T>
            <ArrowUpRight size={18}/>
          </button>
          <button className="studio-reset" onClick={() => setOptions(defaultPizza)}>
            <RotateCcw size={13}/><T space>{"Start fresh"}</T></button>
          <p className="studio-allergens"><T space>{"Base contains wheat and milk. Extra toppings may change dietary suitability. Shared kitchen handles eggs and nuts."}</T></p>
        </div>
      </div>
    </section>);
}
