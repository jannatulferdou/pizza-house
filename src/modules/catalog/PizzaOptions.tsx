import { T } from "../../app/Locale";
import { money } from "../../shared/commerce";
import { pizzaSizes, pizzaCrusts, pizzaToppings, } from "../../shared/pizza-options";
import type { PizzaConfiguration } from "../../shared/types";
export function PizzaOptions({ value, onChange, }: {
    value: PizzaConfiguration;
    onChange: (value: PizzaConfiguration) => void;
}) {
    return (<div className="pizza-options">
      <fieldset>
        <legend><T space>{"01 / Your size"}</T></legend>
        <div className="option-row">
          <T>{pizzaSizes.map((size) => (<button type="button" key={size.id} aria-pressed={value.size === size.id} onClick={() => onChange({ ...value, size: size.id })}>
              <T>{size.label}</T>
              <small><T>{size.price ? `+${money(size.price)}` : "Original"}</T></small>
            </button>))}</T>
        </div>
      </fieldset>
      <fieldset>
        <legend><T space>{"02 / Your crust"}</T></legend>
        <div className="option-row">
          <T>{pizzaCrusts.map((crust) => (<button type="button" key={crust.id} aria-pressed={value.crust === crust.id} onClick={() => onChange({ ...value, crust: crust.id })}>
              <T>{crust.label}</T>
              <small>
                <T>{crust.price ? `+${money(crust.price)}` : "Included"}</T>
              </small>
            </button>))}</T>
        </div>
      </fieldset>
      <fieldset>
        <legend><T space>{"03 / A little extra"}</T><span><T space>{"Optional toppings"}</T></span>
        </legend>
        <div className="topping-options">
          <T>{pizzaToppings.map((topping) => (<label key={topping.id}>
              <input type="checkbox" checked={value.toppings.includes(topping.id)} onChange={(e) => onChange({
            ...value,
            toppings: e.target.checked
                ? [...value.toppings, topping.id]
                : value.toppings.filter((id) => id !== topping.id),
        })}/>
              <span>
                <T>{topping.label}</T>
                <T>{topping.allergen && <small><T>{topping.allergen}</T></small>}</T>
              </span>
              <b>+<T>{money(topping.price)}</T></b>
            </label>))}</T>
        </div>
      </fieldset>
      <T>{value.crust === "cheese" && (<p className="option-allergens"><T space>{"Cheese-stuffed crust contains milk."}</T></p>)}</T>
    </div>);
}
export function ConfiguredPhoto({ src, name, value, }: {
    src: string;
    name: string;
    value: PizzaConfiguration;
}) {
    return (<div className={`configured-photo crust-${value.crust} size-${value.size}`}>
      <div className="configured-pizza">
        <img src={src} alt={name} width="600" height="600"/>
        <div className="topping-preview" aria-hidden="true">
          <T>{value.toppings.flatMap((topping, index) => Array.from({ length: 6 }, (_, i) => (<i key={`${topping}-${i}`} className={`preview-${topping}`} style={{
            left: `${50 + Math.cos(i * 2.4 + index) * (18 + (i % 2) * 12)}%`,
            top: `${50 + Math.sin(i * 2.4 + index) * (18 + (i % 2) * 12)}%`,
            rotate: `${i * 49}deg`,
        }}/>)))}</T>
        </div>
      </div>
      <span className="preview-caption"><T space>{"Illustrative topping preview \u00B7"}</T><T space>{" "}</T>
        <T>{value.size === "large" ? "14-inch" : "12-inch"}</T>
      </span>
    </div>);
}
