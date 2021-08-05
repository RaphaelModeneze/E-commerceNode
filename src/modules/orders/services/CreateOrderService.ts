import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) throw new AppError("couldn't find customer");
    const productExists = await this.productsRepository.findAllById(products);

    if (!productExists.length) throw new AppError("couldn't find products");

    const productExistsId = productExists.map(prod => prod.id);

    const checkInexistentProd = products.filter(
      prod => !productExistsId.includes(prod.id),
    );

    if (checkInexistentProd.length) {
      throw new AppError(`Could not find product ${checkInexistentProd[0].id}`);
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      prod =>
        productExists.filter(p => p.id === prod.id)[0].quantity < prod.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `Product with no enough quantity ${findProductsWithNoQuantityAvailable[0].quantity}`,
      );
    }

    const product = products.map(prod => ({
      product_id: prod.id,
      quantity: prod.quantity,
      price: productExists.filter(p => p.id === prod.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: product,
    });

    const { order_products } = order;

    const orderedProdQuantity = order_products.map(p => ({
      id: p.product_id,
      quantity:
        productExists.filter(prod => prod.id === p.product_id)[0].quantity -
        p.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProdQuantity);

    return order;
  }
}

export default CreateOrderService;
