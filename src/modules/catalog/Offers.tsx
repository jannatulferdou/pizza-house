import { T } from "../../app/Locale";
import { TicketPercent } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { money } from "../../shared/commerce";
export function Offers() {
    const { config } = useStore();
    if (!config?.offers.length)
        return null;
    return (<section className="offers-strip" aria-label="Current offers">
      <T>{config.offers.map((offer) => (<div key={offer.code}>
          <TicketPercent size={25}/>
          <div>
            <b><T space>{"A little extra good."}</T><T>{offer.percent}</T><T space>{"% off."}</T></b>
            <p><T space>{"Use"}</T><strong><T>{offer.code}</T></strong><T space>{"on orders from"}</T><T space>{" "}</T>
              <T>{money(offer.minimum)}</T><T space>{". Applied to food subtotal."}</T></p>
          </div>
          <a href="#menu"><T space>{"Find your favorite \u2197"}</T></a>
        </div>))}</T>
    </section>);
}
