/* eslint react/no-multi-comp:0 */
import React, { Component } from 'react'
import TestUtils from 'react-addons-test-utils'
import { createSpy } from 'expect'
import { combineReducers as plainCombineReducers, createStore } from 'redux'
import { combineReducers as immutableCombineReducers } from 'redux-immutablejs'
import { Provider } from 'react-redux'
import Field from '../Field'
import noop from '../util/noop'
import createReducer from '../reducer'
import createReduxForm from '../reduxForm'
import createField from '../Field'
import plain from '../structure/plain'
import plainExpectations from '../structure/plain/expectations'
import immutable from '../structure/immutable'
import immutableExpectations from '../structure/immutable/expectations'
import addExpectations from './addExpectations'
import { change } from '../actions'

const describeReduxForm = (name, structure, combineReducers, expect) => {
  const { fromJS, getIn } = structure
  const reduxForm = createReduxForm(structure)
  const Field = createField(structure)
  const reducer = createReducer(structure)

  describe(name, () => {
    const makeStore = (initial = {}) => createStore(
      combineReducers({ form: reducer }), fromJS({ form: initial }))

    const propChecker = (formState, renderSpy = noop, config = {}) => {
      const store = makeStore({ testForm: formState })
      class Form extends Component {
        render() {
          renderSpy(this.props)
          return (
            <div>
              <Field name="foo" component={React.DOM.input}/>
            </div>
          )
        }
      }
      const Decorated = reduxForm({ form: 'testForm', ...config })(Form)
      const dom = TestUtils.renderIntoDocument(
        <Provider store={store}>
          <Decorated/>
        </Provider>
      )
      return TestUtils.findRenderedComponentWithType(dom, Form).props
    }

    it('should return a decorator function', () => {
      expect(reduxForm).toBeA('function')
    })

    it('should render without error', () => {
      const store = makeStore()
      class Form extends Component {
        render() {
          return <div />
        }
      }
      expect(() => {
        const Decorated = reduxForm({ form: 'testForm' })(Form)
        TestUtils.renderIntoDocument(
          <Provider store={store}>
            <Decorated/>
          </Provider>
        )
      }).toNotThrow()
    })

    it('should provide dispatch', () => {
      expect(propChecker({}).dispatch)
        .toExist()
        .toBeA('function')
    })

    it('should provide dirty', () => {
      expect(propChecker({}).dirty).toBe(false)
      expect(propChecker({
        // no initial values
        values: {
          foo: 'bar'
        }
      }).dirty).toBe(true)
      expect(propChecker({
        initial: {
          foo: 'bar'
        },
        values: {
          foo: 'bar'
        }
      }).dirty).toBe(false)
      expect(propChecker({
        initial: {
          foo: 'bar'
        },
        values: {
          foo: 'baz'
        }
      }).dirty).toBe(true)
    })

    it('should provide pristine', () => {
      expect(propChecker({}).pristine).toBe(true)
      expect(propChecker({
        // no initial values
        values: {
          foo: 'bar'
        }
      }).pristine).toBe(false)
      expect(propChecker({
        initial: {
          foo: 'bar'
        },
        values: {
          foo: 'bar'
        }
      }).pristine).toBe(true)
      expect(propChecker({
        initial: {
          foo: 'bar'
        },
        values: {
          foo: 'baz'
        }
      }).pristine).toBe(false)
    })

    it('should provide valid', () => {
      expect(propChecker({}).valid).toBe(true)
      expect(propChecker({}, undefined, {
        validate: () => ({ foo: 'sync error' })
      }).valid).toBe(false)
      expect(propChecker({
        asyncErrors: {
          foo: 'bar'
        }
      }).valid).toBe(false)
    })

    it('should provide invalid', () => {
      expect(propChecker({}).invalid).toBe(false)
      expect(propChecker({}, undefined, {
        validate: () => ({ foo: 'sync error' })
      }).invalid).toBe(true)
      expect(propChecker({
        asyncErrors: {
          foo: 'bar'
        }
      }).invalid).toBe(true)
    })

    it('should provide submitting', () => {
      expect(propChecker({}).submitting).toBe(false)
      expect(propChecker({ submitting: true }).submitting).toBe(true)
      expect(propChecker({ submitting: false }).submitting).toBe(false)
    })

    it('should provide error', () => {
      expect(Object.keys(propChecker({})).indexOf('error')).toNotBe(-1)
    })

    it('should not rerender unless form-wide props (except value!) change', () => {
      const spy = createSpy()
      const { dispatch } = propChecker({}, spy, {
        validate: values => {
          const animal = getIn(values, 'animal')
          return animal && animal.length > 5 ? { animal: 'Too long' } : {}
        }
      })  // render 0
      expect(spy.calls.length).toBe(1)

      // simulate typing the word "giraffe"
      dispatch({ ...change('g'), form: 'testForm', field: 'animal' })       // render 1 (now dirty)
      expect(spy.calls.length).toBe(2)

      dispatch({ ...change('gi'), form: 'testForm', field: 'animal' })      // no render
      dispatch({ ...change('gir'), form: 'testForm', field: 'animal' })     // no render
      dispatch({ ...change('gira'), form: 'testForm', field: 'animal' })    // no render
      dispatch({ ...change('giraf'), form: 'testForm', field: 'animal' })   // no render
      dispatch({ ...change('giraff'), form: 'testForm', field: 'animal' })  // render 2 (invalid)
      expect(spy.calls.length).toBe(3)
      dispatch({ ...change('giraffe'), form: 'testForm', field: 'animal' }) // no render

      dispatch({ ...change(''), form: 'testForm', field: 'animal' }) // render 3 (clean/valid)
      expect(spy.calls.length).toBe(4)

      expect(spy).toHaveBeenCalled()

      expect(spy.calls[ 0 ].arguments[ 0 ].dirty).toBe(false)
      expect(spy.calls[ 0 ].arguments[ 0 ].invalid).toBe(false)
      expect(spy.calls[ 0 ].arguments[ 0 ].pristine).toBe(true)
      expect(spy.calls[ 0 ].arguments[ 0 ].valid).toBe(true)

      expect(spy.calls[ 1 ].arguments[ 0 ].dirty).toBe(true)
      expect(spy.calls[ 1 ].arguments[ 0 ].invalid).toBe(false)
      expect(spy.calls[ 1 ].arguments[ 0 ].pristine).toBe(false)
      expect(spy.calls[ 1 ].arguments[ 0 ].valid).toBe(true)

      expect(spy.calls[ 2 ].arguments[ 0 ].dirty).toBe(true)
      expect(spy.calls[ 2 ].arguments[ 0 ].invalid).toBe(true)
      expect(spy.calls[ 2 ].arguments[ 0 ].pristine).toBe(false)
      expect(spy.calls[ 2 ].arguments[ 0 ].valid).toBe(false)

      expect(spy.calls.length).toBe(4)
      expect(spy.calls[ 3 ].arguments[ 0 ].dirty).toBe(false)
      expect(spy.calls[ 3 ].arguments[ 0 ].invalid).toBe(false)
      expect(spy.calls[ 3 ].arguments[ 0 ].pristine).toBe(true)
      expect(spy.calls[ 3 ].arguments[ 0 ].valid).toBe(true)
    })

    it('should initialize values with initialValues on first render', () => {
      const store = makeStore({})
      const inputRender = createSpy(React.DOM.input).andCallThrough()
      const formRender = createSpy()
      const initialValues = {
        deep: {
          foo: 'bar'
        }
      }
      class Form extends Component {
        render() {
          formRender(this.props)
          return (
            <form>
              <Field name="deep.foo" component={inputRender} type="text"/>
            </form>
          )
        }
      }
      const Decorated = reduxForm({ form: 'testForm' })(Form)
      TestUtils.renderIntoDocument(
        <Provider store={store}>
          <Decorated initialValues={initialValues}/>
        </Provider>
      )
      expect(store.getState()).toEqualMap({
        form: {
          testForm: {
            initial: initialValues,
            values: initialValues
          }
        }
      })
      expect(formRender).toHaveBeenCalled()
      expect(formRender.calls.length).toBe(1)
      const checkProps = props => {
        expect(props.pristine).toBe(true)
        expect(props.dirty).toBe(false)
        expect(props.initialized).toBe(false) // will be true on second render
      }
      checkProps(formRender.calls[ 0 ].arguments[ 0 ])

      expect(inputRender).toHaveBeenCalled()
      expect(inputRender.calls.length).toBe(1)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].pristine).toBe(true)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].dirty).toBe(false)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].value).toBe('bar')
    })

    it('should initialize with initialValues on later render', () => {
      const store = makeStore({})
      const inputRender = createSpy(React.DOM.input).andCallThrough()
      const formRender = createSpy()
      const initialValues = {
        deep: {
          foo: 'bar'
        }
      }

      class Form extends Component {
        render() {
          formRender(this.props)
          return (
            <form>
              <Field name="deep.foo" component={inputRender} type="text"/>
            </form>
          )
        }
      }
      const Decorated = reduxForm({ form: 'testForm' })(Form)

      class Container extends Component {
        constructor(props) {
          super(props)
          this.state = {}
        }

        render() {
          return (
            <div>
              <Provider store={store}>
                <Decorated {...this.state}/>
              </Provider>
              <button onClick={() => this.setState({ initialValues })}>Init</button>
            </div>
          )
        }
      }

      const dom = TestUtils.renderIntoDocument(<Container/>)
      expect(store.getState()).toEqualMap({
        form: {}
      })
      expect(formRender).toHaveBeenCalled()
      expect(formRender.calls.length).toBe(1)
      const checkFormProps = props => {
        expect(props.pristine).toBe(true)
        expect(props.dirty).toBe(false)
        expect(props.initialized).toBe(false)
      }
      checkFormProps(formRender.calls[ 0 ].arguments[ 0 ])

      expect(inputRender).toHaveBeenCalled()
      expect(inputRender.calls.length).toBe(1)
      const checkInputProps = (props, value) => {
        expect(props.pristine).toBe(true)
        expect(props.dirty).toBe(false)
        expect(props.value).toBe(value)
      }
      checkInputProps(inputRender.calls[ 0 ].arguments[ 0 ], '')

      // initialize
      const initButton = TestUtils.findRenderedDOMComponentWithTag(dom, 'button')
      TestUtils.Simulate.click(initButton)

      // check initialized state
      expect(store.getState()).toEqualMap({
        form: {
          testForm: {
            initial: initialValues,
            values: initialValues
          }
        }
      })

      // no need to rerender form on initialize
      expect(formRender.calls.length).toBe(1)

      // check rerendered input
      expect(inputRender.calls.length).toBe(2)
      checkInputProps(inputRender.calls[ 1 ].arguments[ 0 ], 'bar')
    })

    it('should call async on blur of async blur field', done => {
      const store = makeStore({})
      const inputRender = createSpy(React.DOM.input).andCallThrough()
      const formRender = createSpy()
      const asyncErrors = {
        deep: {
          foo: 'async error'
        }
      }
      const asyncValidate = createSpy().andReturn(Promise.reject(asyncErrors))

      class Form extends Component {
        render() {
          formRender(this.props)
          return (
            <form>
              <Field name="deep.foo" component={inputRender} type="text"/>
            </form>
          )
        }
      }
      const Decorated = reduxForm({
        form: 'testForm',
        asyncValidate,
        asyncBlurFields: [ 'deep.foo' ]
      })(Form)

      const dom = TestUtils.renderIntoDocument(
        <Provider store={store}>
          <Decorated/>
        </Provider>
      )
      expect(store.getState()).toEqualMap({
        form: {}
      })
      expect(formRender).toHaveBeenCalled()
      expect(formRender.calls.length).toBe(1)

      expect(asyncValidate).toNotHaveBeenCalled()

      expect(inputRender).toHaveBeenCalled()
      expect(inputRender.calls.length).toBe(1)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].pristine).toBe(true)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].value).toBe('')
      expect(inputRender.calls[ 0 ].arguments[ 0 ].valid).toBe(true)
      expect(inputRender.calls[ 0 ].arguments[ 0 ].error).toBe(undefined)

      const inputElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'input')
      TestUtils.Simulate.change(inputElement, { target: { value: 'bar' } })

      expect(store.getState()).toEqualMap({
        form: {
          testForm: {
            values: {
              deep: {
                foo: 'bar'
              }
            }
          }
        }
      })
      expect(formRender.calls.length).toBe(2) // rerendered because pristine -> dirty

      expect(asyncValidate).toNotHaveBeenCalled() // not yet

      expect(inputRender.calls.length).toBe(2)  // input rerendered
      expect(inputRender.calls[ 1 ].arguments[ 0 ].pristine).toBe(false)
      expect(inputRender.calls[ 1 ].arguments[ 0 ].value).toBe('bar')
      expect(inputRender.calls[ 1 ].arguments[ 0 ].valid).toBe(true)
      expect(inputRender.calls[ 1 ].arguments[ 0 ].error).toBe(undefined)

      TestUtils.Simulate.blur(inputElement, { target: { value: 'bar' } })

      setTimeout(() => {
        expect(store.getState()).toEqualMap({
          form: {
            testForm: {
              anyTouched: true,
              values: {
                deep: {
                  foo: 'bar'
                }
              },
              fields: {
                deep: {
                  foo: {
                    touched: true
                  }
                }
              },
              asyncErrors
            }
          }
        })
        // rerender form twice because of async validation start and again for valid -> invalid
        expect(formRender.calls.length).toBe(4)

        expect(asyncValidate).toHaveBeenCalled()
        expect(asyncValidate.calls[ 0 ].arguments[ 0 ]).toEqualMap({ deep: { foo: 'bar' } })

        // input rerendered twice, at start and end of async validation
        expect(inputRender.calls.length).toBe(4)
        expect(inputRender.calls[ 3 ].arguments[ 0 ].pristine).toBe(false)
        expect(inputRender.calls[ 3 ].arguments[ 0 ].value).toBe('bar')
        expect(inputRender.calls[ 3 ].arguments[ 0 ].valid).toBe(false)
        expect(inputRender.calls[ 3 ].arguments[ 0 ].error).toBe('async error')
        done()
      })
    })

    describe('form level errors', () => {
      it('should come from synchronous validation _error', () => {
        const validate = () => {_error: 'foo'}
        const config = { validate }
        expect(propChecker({}, noop, config).error).toBe('foo')
      })

      it('should come from async validation _error', done => {
        const store = makeStore({})
        const inputRender = createSpy(React.DOM.input).andCallThrough()
        const formRender = createSpy()
        const asyncErrors = {
          _error: 'foo'
        }
        const asyncValidate = createSpy().andReturn(Promise.reject(asyncErrors))

        class Form extends Component {
          render() {
            formRender(this.props)
            return (
              <form>
                <Field name="foo" component={inputRender} type="text"/>
              </form>
            )
          }
        }
        const Decorated = reduxForm({
          form: 'testForm',
          asyncValidate
        })(Form)

        const dom = TestUtils.renderIntoDocument(
          <Provider store={store}>
            <Decorated/>
          </Provider>
        )
        expect(store.getState()).toEqualMap({
          form: {}
        })
        expect(formRender).toHaveBeenCalled()
        expect(asyncValidate).toNotHaveBeenCalled()

        formRender.reset()
        const inputElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'input')
        TestUtils.Simulate.change(inputElement, { target: { value: 'bar' } })
        expect(formRender).toHaveBeenCalled() // rerendered because pristine -> dirty
        expect(asyncValidate).toNotHaveBeenCalled() // not yet

        formRender.reset()
        TestUtils.Simulate.blur(inputElement, { target: { value: 'bar' } })
        setTimeout(() => {
          expect(asyncValidate).toHaveBeenCalled()
          expect(formRender).toHaveBeenCalled()
          let lastCall = formRender.calls[formRender.calls.length - 1]
          expect(lastCall.arguments[0].error).toBe('foo')  // the meat of the test right here
          done()
        })
      })

      it('should come from async submit _error', done => {
        const store = makeStore({})
        const formRender = createSpy()
        const submitErrors = {
          _error: 'foo'
        }
        const doSubmit = createSpy().andReturn(Promise.reject(submitErrors))

        class Form extends Component {
          render() {
            formRender(this.props)
            return (
              <form onSubmit={this.props.handleSubmit(doSubmit)}></form>
            )
          }
        }
        const Decorated = reduxForm({
          form: 'testForm'
        })(Form)

        const dom = TestUtils.renderIntoDocument(
          <Provider store={store}>
            <Decorated/>
          </Provider>
        )
        expect(store.getState()).toEqualMap({
          form: {}
        })
        expect(formRender).toHaveBeenCalled()

        formRender.reset()
        const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
        TestUtils.Simulate.submit(formElement)
        setTimeout(() => {
          expect(formRender).toHaveBeenCalled()
          let lastCall = formRender.calls[formRender.calls.length - 1]
          expect(lastCall.arguments[0].error).toBe('foo')  // the meat of the test right here
          done()
        })
      })
    })
  })
}

//const reduxForm = createReduxForm(false, React, connect)
//const makeStore = () => createStore(combineReducers({
//  form: reducer
//}))
//
//it('should return a decorator function', () => {
//  expect(reduxForm).toBeA('function')
//})
//
//class Form extends Component {
//  render() {
//    return <div />
//  }
//}
//
//const expectField = ({field, name, value, initial, valid, dirty, error, touched, visited, readonly}) => {
//  expect(field).toBeA('object')
//  expect(field.name).toBe(name)
//  expect(field.value).toEqual(value)
//  if (readonly) {
//    expect(field.onBlur).toNotExist()
//    expect(field.onChange).toNotExist()
//    expect(field.onDragStart).toNotExist()
//    expect(field.onDrop).toNotExist()
//    expect(field.onFocus).toNotExist()
//    expect(field.onUpdate).toNotExist()
//  } else {
//    expect(field.onBlur).toBeA('function')
//    expect(field.onChange).toBeA('function')
//    expect(field.onDragStart).toBeA('function')
//    expect(field.onDrop).toBeA('function')
//    expect(field.onFocus).toBeA('function')
//    expect(field.onUpdate).toBeA('function')
//  }
//  expect(field.initialValue).toEqual(initial)
//  expect(field.defaultValue).toEqual(initial)
//  expect(field.defaultChecked).toBe(initial === true)
//  expect(field.valid).toBe(valid)
//  expect(field.invalid).toBe(!valid)
//  expect(field.dirty).toBe(dirty)
//  expect(field.pristine).toBe(!dirty)
//  expect(field.error).toEqual(error)
//  expect(field.touched).toBe(touched)
//  expect(field.visited).toBe(visited)
//}
//
//it('should render without error', () => {
//  const store = makeStore()
//  expect(() => {
//    const Decorated = reduxForm({
//      form: 'testForm',
//      fields: ['foo', 'bar']
//    })(Form)
//    TestUtils.renderIntoDocument(
//      <Provider store={store}>
//        <Decorated/>
//      </Provider>
//    )
//  }).toNotThrow()
//})
//
//it('should pass fields as props', () => {
//  const store = makeStore()
//  const Decorated = reduxForm({
//    form: 'testForm',
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should initialize field values', () => {
//  const store = makeStore()
//  const Decorated = reduxForm({
//    form: 'testForm',
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: 'fooValue', bar: 'barValue'}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: 'fooValue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: 'barValue',
//    initial: 'barValue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set value and touch field on blur', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onBlur('fooValue')
//
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: undefined,
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: true,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set value and NOT touch field on blur if touchOnBlur is disabled', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    touchOnBlur: false
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onBlur('fooValue')
//
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: undefined,
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set value and NOT touch field on change', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onChange('fooValue')
//
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: undefined,
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set value and touch field on change if touchOnChange is enabled', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    touchOnChange: true
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onChange('fooValue')
//
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: undefined,
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: true,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set visited field on focus', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.active).toBe(undefined)
//
//  stub.props.fields.foo.onFocus()
//
//  expect(stub.props.active).toBe('foo')
//
//  expect(stub.props.fields).toBeA('object')
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: true,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set dirty when field changes', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: 'fooValue', bar: 'barValue'}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: 'fooValue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  stub.props.fields.foo.onChange('fooValue!')
//
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue!',
//    initial: 'fooValue',
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should set dirty when and array field changes', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['children[].name']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{children: [{name: 'Tom'}, {name: 'Jerry'}]}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//  expect(stub.props.fields.children).toBeA('array')
//  expect(stub.props.fields.children.length).toBe(2)
//
//  expectField({
//    field: stub.props.fields.children[0].name,
//    name: 'children[0].name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.children[1].name,
//    name: 'children[1].name',
//    value: 'Jerry',
//    initial: 'Jerry',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  stub.props.fields.children[0].name.onChange('Tim')
//
//  expectField({
//    field: stub.props.fields.children[0].name,
//    name: 'children[0].name',
//    value: 'Tim',
//    initial: 'Tom',
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expectField({
//    field: stub.props.fields.children[1].name,
//    name: 'children[1].name',
//    value: 'Jerry',
//    initial: 'Jerry',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//})
//
//it('should trigger sync error on change that invalidates value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    validate: values => {
//      const errors = {}
//      if (values.foo && values.foo.length > 8) {
//        errors.foo = 'Too long'
//      }
//      if (!values.bar) {
//        errors.bar = 'Required'
//      }
//      return errors
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: 'fooValue', bar: 'barValue'}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue',
//    initial: 'fooValue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: 'barValue',
//    initial: 'barValue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expect(stub.props.valid).toBe(true)
//  expect(stub.props.invalid).toBe(false)
//  expect(stub.props.errors).toEqual({})
//
//  stub.props.fields.foo.onChange('fooValue!')
//
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: 'fooValue!',
//    initial: 'fooValue',
//    valid: false,
//    dirty: true,
//    error: 'Too long',
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  stub.props.fields.bar.onChange('')
//
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: '',
//    initial: 'barValue',
//    valid: false,
//    dirty: true,
//    error: 'Required',
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  expect(stub.props.valid).toBe(false)
//  expect(stub.props.invalid).toBe(true)
//  expect(stub.props.errors).toEqual({
//    foo: 'Too long',
//    bar: 'Required'
//  })
//})
//
//it('should trigger sync error on change that invalidates nested value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo.bar'],
//    validate: values => {
//      const errors = {}
//      if (values.foo.bar && values.foo.bar.length > 8) {
//        errors.foo = {bar: 'Too long'}
//      }
//      return errors
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: {bar: 'fooBar'}}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.foo.bar,
//    name: 'foo.bar',
//    value: 'fooBar',
//    initial: 'fooBar',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expect(stub.props.valid).toBe(true)
//  expect(stub.props.invalid).toBe(false)
//  expect(stub.props.errors).toEqual({})
//
//  stub.props.fields.foo.bar.onChange('fooBarBaz')
//
//  expectField({
//    field: stub.props.fields.foo.bar,
//    name: 'foo.bar',
//    value: 'fooBarBaz',
//    initial: 'fooBar',
//    valid: false,
//    dirty: true,
//    error: 'Too long',
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  expect(stub.props.valid).toBe(false)
//  expect(stub.props.invalid).toBe(true)
//  expect(stub.props.errors).toEqual({
//    foo: {
//      bar: 'Too long'
//    }
//  })
//})
//
//it('should trigger sync error on change that invalidates array value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo[]', 'bar[].name'],
//    validate: values => {
//      const errors = {}
//      if (values.foo && values.foo.length && values.foo[0] && values.foo[0].length > 8) {
//        errors.foo = ['Too long']
//      }
//      if (values.bar && values.bar.length && values.bar[0] && values.bar[0].name === 'Ralphie') {
//        errors.bar = [{name: `You'll shoot your eye out, kid!`}]
//      }
//      return errors
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: ['fooBar'], bar: [{name: ''}]}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.foo[0],
//    name: 'foo[0]',
//    value: 'fooBar',
//    initial: 'fooBar',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  expectField({
//    field: stub.props.fields.bar[0].name,
//    name: 'bar[0].name',
//    value: '',
//    initial: '',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//  expect(stub.props.valid).toBe(true)
//  expect(stub.props.invalid).toBe(false)
//  expect(stub.props.errors).toEqual({})
//
//  stub.props.fields.foo[0].onChange('fooBarBaz')
//
//  expectField({
//    field: stub.props.fields.foo[0],
//    name: 'foo[0]',
//    value: 'fooBarBaz',
//    initial: 'fooBar',
//    valid: false,
//    dirty: true,
//    error: 'Too long',
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  stub.props.fields.bar[0].name.onChange('Ralphie')
//
//  expectField({
//    field: stub.props.fields.bar[0].name,
//    name: 'bar[0].name',
//    value: 'Ralphie',
//    initial: '',
//    valid: false,
//    dirty: true,
//    error: `You'll shoot your eye out, kid!`,
//    touched: false,
//    visited: false,
//    readonly: false
//  })
//
//  expect(stub.props.valid).toBe(false)
//  expect(stub.props.invalid).toBe(true)
//  expect(stub.props.errors).toEqual({
//    foo: ['Too long'],
//    bar: [{name: `You'll shoot your eye out, kid!`}]
//  })
//})
//
//it('should call destroy on unmount', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar']
//  })(Form)
//
//  const div = document.createElement('div')
//  ReactDOM.render(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: 'fooValue', bar: 'barValue'}}/>
//    </Provider>,
//    div
//  )
//  const before = store.getState()
//  expect(before.form).toBeA('object')
//  expect(before.form[form]).toBeA('object')
//  expect(before.form[form].foo).toBeA('object')
//  expect(before.form[form].bar).toBeA('object')
//
//  ReactDOM.unmountComponentAtNode(div)
//
//  const after = store.getState()
//  expect(after.form).toBeA('object')
//  expect(after.form[form]).toNotExist()
//})
//
//it('should NOT call destroy on unmount if destroyOnUnmount is disabled', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    destroyOnUnmount: false
//  })(Form)
//
//  const div = document.createElement('div')
//  ReactDOM.render(
//    <Provider store={store}>
//      <Decorated initialValues={{foo: 'fooValue', bar: 'barValue'}}/>
//    </Provider>,
//    div
//  )
//  const before = store.getState()
//  expect(before.form).toBeA('object')
//  expect(before.form[form]).toBeA('object')
//  expect(before.form[form].foo).toBeA('object')
//  expect(before.form[form].bar).toBeA('object')
//
//  ReactDOM.unmountComponentAtNode(div)
//
//  const after = store.getState()
//  expect(after.form).toBeA('object')
//  expect(after.form[form]).toBeA('object')
//  expect(after.form[form].foo).toBeA('object')
//  expect(after.form[form].bar).toBeA('object')
//})
//
//it('should hoist statics', () => {
//  class FormWithStatics extends Component {
//    render() {
//      return <div/>
//    }
//  }
//  FormWithStatics.someStatic1 = 'cat'
//  FormWithStatics.someStatic2 = 42
//
//  const Decorated = reduxForm({
//    form: 'testForm',
//    fields: ['foo', 'bar']
//  })(FormWithStatics)
//
//  expect(Decorated.someStatic1).toBe('cat')
//  expect(Decorated.someStatic2).toBe(42)
//})
//
//it('should not provide mutators when readonly', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    readonly: true
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.foo,
//    name: 'foo',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: true
//  })
//
//  expectField({
//    field: stub.props.fields.bar,
//    name: 'bar',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false,
//    readonly: true
//  })
//})
//
//it('should initialize an array field', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['children[].name'],
//    initialValues: {
//      children: [{name: 'Tom'}, {name: 'Jerry'}]
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.children[0].name,
//    name: 'children[0].name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//
//  expectField({
//    field: stub.props.fields.children[1].name,
//    name: 'children[1].name',
//    value: 'Jerry',
//    initial: 'Jerry',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should call onSubmit prop', (done) => {
//  const submit = (values) => {
//    expect(values).toEqual({
//      foo: undefined,
//      bar: undefined
//    })
//    done()
//  }
//
//  class FormComponent extends Component {
//    render() {
//      return (
//        <form onSubmit={this.props.handleSubmit}/>
//      )
//    }
//  }
//  FormComponent.propTypes = {
//    handleSubmit: PropTypes.func.isRequired
//  }
//
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    readonly: true
//  })(FormComponent)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated onSubmit={submit}/>
//    </Provider>
//  )
//  const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
//
//  TestUtils.Simulate.submit(formElement)
//})
//
//it('should call async onSubmit prop', (done) => {
//  const submit = (values) => {
//    expect(values).toEqual({
//      foo: undefined,
//      bar: undefined
//    })
//    return new Promise(resolve => {
//      setTimeout(() => {
//        resolve()
//      }, 100)
//    }).then(done)
//  }
//
//  class FormComponent extends Component {
//    render() {
//      return (
//        <form onSubmit={this.props.handleSubmit}/>
//      )
//    }
//  }
//  FormComponent.propTypes = {
//    handleSubmit: PropTypes.func.isRequired
//  }
//
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    readonly: true
//  })(FormComponent)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated onSubmit={submit}/>
//    </Provider>
//  )
//  const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
//
//  TestUtils.Simulate.submit(formElement)
//})
//
//it('should NOT call async validation if form is pristine and initialized', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const errorValue = {foo: 'no bears allowed'}
//  const asyncValidate = createSpy().andReturn(Promise.reject(errorValue))
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    asyncValidate,
//    asyncBlurFields: ['foo'],
//    initialValues: {
//      foo: 'dog',
//      bar: 'cat'
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onBlur('dog')
//  expect(asyncValidate).toNotHaveBeenCalled()
//})
//
//it('should call async validation if form is dirty and initialized', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const errorValue = {foo: 'no bears allowed'}
//  const asyncValidate = createSpy().andReturn(Promise.reject(errorValue))
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    asyncValidate,
//    asyncBlurFields: ['foo'],
//    initialValues: {
//      foo: 'dog',
//      bar: 'cat'
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onBlur('bear')
//  expect(asyncValidate).toHaveBeenCalled()
//})
//
//it('should call async validation if form is pristine and NOT initialized', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const errorValue = {foo: 'no bears allowed'}
//  const asyncValidate = createSpy().andReturn(Promise.reject(errorValue))
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    asyncValidate,
//    asyncBlurFields: ['foo']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.foo.onBlur()
//  expect(asyncValidate).toHaveBeenCalled()
//})
//
//it('should call async validation on submit even if pristine and initialized', () => {
//  const submit = createSpy()
//  class FormComponent extends Component {
//    render() {
//      return (
//        <form onSubmit={this.props.handleSubmit(submit)}/>
//      )
//    }
//  }
//  FormComponent.propTypes = {
//    handleSubmit: PropTypes.func.isRequired
//  }
//
//  const store = makeStore()
//  const form = 'testForm'
//  const errorValue = {foo: 'no dogs allowed'}
//  const asyncValidate = createSpy().andReturn(Promise.reject(errorValue))
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    asyncValidate,
//    asyncBlurFields: ['foo'],
//    initialValues: {
//      foo: 'dog',
//      bar: 'cat'
//    }
//  })(FormComponent)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
//
//  TestUtils.Simulate.submit(formElement)
//
//  expect(asyncValidate).toHaveBeenCalled()
//  expect(submit).toNotHaveBeenCalled()
//})
//
//it('should call submit function passed to handleSubmit', (done) => {
//  const submit = (values) => {
//    expect(values).toEqual({
//      foo: undefined,
//      bar: undefined
//    })
//    done()
//  }
//
//  class FormComponent extends Component {
//    render() {
//      return (
//        <form onSubmit={this.props.handleSubmit(submit)}/>
//      )
//    }
//  }
//
//  FormComponent.propTypes = {
//    handleSubmit: PropTypes.func.isRequired
//  }
//
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    readonly: true
//  })(FormComponent)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated />
//    </Provider>
//  )
//  const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
//
//  TestUtils.Simulate.submit(formElement)
//})
//
//it('should call submit function passed to async handleSubmit', (done) => {
//  const submit = (values) => {
//    expect(values).toEqual({
//      foo: undefined,
//      bar: undefined
//    })
//    return new Promise(resolve => {
//      setTimeout(() => {
//        resolve()
//      }, 100)
//    }).then(done)
//  }
//
//  class FormComponent extends Component {
//    render() {
//      return (
//        <form onSubmit={this.props.handleSubmit(submit)}/>
//      )
//    }
//  }
//
//  FormComponent.propTypes = {
//    handleSubmit: PropTypes.func.isRequired
//  }
//
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['foo', 'bar'],
//    readonly: true
//  })(FormComponent)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated />
//    </Provider>
//  )
//  const formElement = TestUtils.findRenderedDOMComponentWithTag(dom, 'form')
//
//  TestUtils.Simulate.submit(formElement)
//})
//
//it('should initialize a non-array field with an array value and let it read it back', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['children'],
//    initialValues: {
//      children: [1, 2]
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.children,
//    name: 'children',
//    value: [1, 2],
//    initial: [1, 2],
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should initialize an array field with an array value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['colors[]'],
//    initialValues: {
//      colors: ['red', 'blue']
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.colors).toBeA('array')
//  expect(stub.props.fields.colors.length).toBe(2)
//  expectField({
//    field: stub.props.fields.colors[0],
//    name: 'colors[0]',
//    value: 'red',
//    initial: 'red',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.colors[1],
//    name: 'colors[1]',
//    value: 'blue',
//    initial: 'blue',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should initialize a deep array field with values', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['users[].name', 'users[].age'],
//    initialValues: {
//      users: [
//        {
//          name: 'Bob',
//          age: 27
//        }
//      ]
//    }
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.users).toBeA('array')
//  expect(stub.props.fields.users.length).toBe(1)
//  expect(stub.props.fields.users[0]).toBeA('object')
//  expectField({
//    field: stub.props.fields.users[0].name,
//    name: 'users[0].name',
//    value: 'Bob',
//    initial: 'Bob',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.users[0].age,
//    name: 'users[0].age',
//    value: 27,
//    initial: 27,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should add array values with defaults', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['users[].name', 'users[].age']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.users).toBeA('array')
//  expect(stub.props.fields.users.length).toBe(0)
//  expect(stub.props.fields.users.addField).toBeA('function')
//
//  const before = stub.props.fields.users
//
//  // add field
//  stub.props.fields.users.addField({name: 'Bob', age: 27})
//
//  // check field
//  expect(stub.props.fields.users.length).toBe(1)
//  expect(stub.props.fields.users[0]).toBeA('object')
//  expectField({
//    field: stub.props.fields.users[0].name,
//    name: 'users[0].name',
//    value: 'Bob',
//    initial: 'Bob',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.users[0].age,
//    name: 'users[0].age',
//    value: 27,
//    initial: 27,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  const after = stub.props.fields.users
//  expect(after).toNotBe(before)  // should be a new instance
//
//  // check state
//  expect(store.getState().form.testForm.users).toBeA('array')
//  expect(store.getState().form.testForm.users.length).toBe(1)
//  expect(store.getState().form.testForm.users[0].name)
//    .toEqual({
//      initial: 'Bob',
//      value: 'Bob'
//    })
//  expect(store.getState().form.testForm.users[0].age)
//    .toEqual({
//      initial: 27,
//      value: 27
//    })
//})
//
//// Test to demonstrate bug: https://github.com/erikras/redux-form/issues/630
//it('should add array values when root is not an array', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: [
//      'acknowledgements.items[].number',
//      'acknowledgements.items[].name',
//      'acknowledgements.show'
//    ]
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.acknowledgements).toBeA('object')
//  expect(stub.props.fields.acknowledgements.items).toBeA('array')
//  expect(stub.props.fields.acknowledgements.items.length).toBe(0)
//  expect(stub.props.fields.acknowledgements.items.addField).toBeA('function')
//
//  // add field
//  stub.props.fields.acknowledgements.items.addField({
//    number: 1,
//    name: 'foo'
//  })
//
//  // check field
//  expect(stub.props.fields.acknowledgements.items.length).toBe(1)
//  expect(stub.props.fields.acknowledgements.items[0]).toBeA('object')
//  expectField({
//    field: stub.props.fields.acknowledgements.items[0].number,
//    name: 'acknowledgements.items[0].number',
//    value: 1,
//    initial: 1,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.acknowledgements.items[0].name,
//    name: 'acknowledgements.items[0].name',
//    value: 'foo',
//    initial: 'foo',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//// Test to demonstrate bug: https://github.com/erikras/redux-form/issues/468
//it('should add array values with DEEP defaults', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: [
//      'proposals[].arrival',
//      'proposals[].departure',
//      'proposals[].note',
//      'proposals[].rooms[].name',
//      'proposals[].rooms[].adults',
//      'proposals[].rooms[].children'
//    ]
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.proposals).toBeA('array')
//  expect(stub.props.fields.proposals.length).toBe(0)
//  expect(stub.props.fields.proposals.addField).toBeA('function')
//
//  // add field
//  const today = new Date()
//  stub.props.fields.proposals.addField({
//    arrival: today,
//    departure: today,
//    note: '',
//    rooms: [{
//      name: 'Room 1',
//      adults: 2,
//      children: 0
//    }]
//  })
//
//  stub.props.fields.proposals[0].rooms.addField({
//    name: 'Room 2',
//    adults: 0,
//    children: 2
//  })
//
//  // check field
//  expect(stub.props.fields.proposals.length).toBe(1)
//  expect(stub.props.fields.proposals[0]).toBeA('object')
//  expectField({
//    field: stub.props.fields.proposals[0].arrival,
//    name: 'proposals[0].arrival',
//    value: today,
//    initial: today,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].departure,
//    name: 'proposals[0].departure',
//    value: today,
//    initial: today,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].note,
//    name: 'proposals[0].note',
//    value: '',
//    initial: '',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[0].name,
//    name: 'proposals[0].rooms[0].name',
//    value: 'Room 1',
//    initial: 'Room 1',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[0].adults,
//    name: 'proposals[0].rooms[0].adults',
//    value: 2,
//    initial: 2,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[0].children,
//    name: 'proposals[0].rooms[0].children',
//    value: 0,
//    initial: 0,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[1].name,
//    name: 'proposals[0].rooms[1].name',
//    value: 'Room 2',
//    initial: 'Room 2',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[1].adults,
//    name: 'proposals[0].rooms[1].adults',
//    value: 0,
//    initial: 0,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  expectField({
//    field: stub.props.fields.proposals[0].rooms[1].children,
//    name: 'proposals[0].rooms[1].children',
//    value: 2,
//    initial: 2,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should initialize an array field, blowing away existing value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['children']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  // set value
//  stub.props.fields.children.onChange([1, 2])
//  // check value
//  expectField({
//    field: stub.props.fields.children,
//    name: 'children',
//    value: [1, 2],
//    initial: undefined,
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // initialize new values
//  stub.props.initializeForm({children: [3, 4]})
//  // check value
//  expectField({
//    field: stub.props.fields.children,
//    name: 'children',
//    value: [3, 4],
//    initial: [3, 4],
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // check state
//  expect(store.getState().form.testForm.children)
//    .toEqual({
//      initial: [3, 4],
//      value: [3, 4]
//    })
//  // reset form to newly initialized values
//  stub.props.resetForm()
//  // check value
//  expectField({
//    field: stub.props.fields.children,
//    name: 'children',
//    value: [3, 4],
//    initial: [3, 4],
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should only initialize on mount once', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['name']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{name: 'Bob'}}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  // check value
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: 'Bob',
//    initial: 'Bob',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // check state
//  expect(store.getState().form.testForm.name)
//    .toEqual({
//      initial: 'Bob',
//      value: 'Bob'
//    })
//  // set value
//  stub.props.fields.name.onChange('Dan')
//  // check value
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: 'Dan',
//    initial: 'Bob',
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // check state
//  expect(store.getState().form.testForm.name)
//    .toEqual({
//      initial: 'Bob',
//      value: 'Dan'
//    })
//
//  // should NOT dispatch INITIALIZE this time
//  const dom2 = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{name: 'Bob'}}/>
//    </Provider>
//  )
//  const stub2 = TestUtils.findRenderedComponentWithType(dom2, Form)
//  // check that value is unchanged
//  expectField({
//    field: stub2.props.fields.name,
//    name: 'name',
//    value: 'Dan',
//    initial: 'Bob',
//    valid: true,
//    dirty: true,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // check state
//  expect(store.getState().form.testForm.name)
//    .toEqual({
//      initial: 'Bob',
//      value: 'Dan'
//    })
//
//  // manually initialize new values
//  stub2.props.initializeForm({name: 'Tom'})
//  // check value
//  expectField({
//    field: stub2.props.fields.name,
//    name: 'name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // check state
//  expect(store.getState().form.testForm.name)
//    .toEqual({
//      initial: 'Tom',
//      value: 'Tom'
//    })
//})
//
//it('should allow initialization from action', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['name']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  // check value
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: undefined,
//    initial: undefined,
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  // manually initialize new values
//  stub.props.initializeForm({name: 'Tom'})
//  // check state
//  expect(store.getState().form.testForm.name)
//    .toEqual({
//      initial: 'Tom',
//      value: 'Tom'
//    })
//  // check value
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should allow deep sync validation error values', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const deepError = {
//    some: 'object with',
//    deep: 'values'
//  }
//  const Decorated = reduxForm({
//    form,
//    fields: ['name'],
//    validate: () => ({name: deepError})
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: undefined,
//    initial: undefined,
//    valid: false,
//    dirty: false,
//    error: deepError,
//    touched: false,
//    visited: false
//  })
//})
//
//it('should allow deep async validation error values', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const deepError = {
//    some: 'object with',
//    deep: 'values'
//  }
//  const Decorated = reduxForm({
//    form,
//    fields: ['name'],
//    initialValues: {name: 'Tom'},
//    asyncValidate: () => Promise.reject({name: deepError})
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  // check field before validation
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//
//  // form must be dirty for asyncValidate()
//  stub.props.fields.name.onChange('Moe')
//
//  return stub.props.asyncValidate()
//    .then(() => {
//      expect(true).toBe(false) // should not be in success block
//    }, () => {
//      // check state
//      expect(store.getState().form.testForm.name)
//        .toEqual({
//          initial: 'Tom',
//          value: 'Moe',
//          asyncError: deepError
//        })
//      // check field
//      expectField({
//        field: stub.props.fields.name,
//        name: 'name',
//        value: 'Moe',
//        initial: 'Tom',
//        valid: false,
//        dirty: true,
//        error: deepError,
//        touched: false,
//        visited: false
//      })
//    })
//})
//
//it('should allow deep submit validation error values', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const deepError = {
//    some: 'object with',
//    deep: 'values'
//  }
//  const Decorated = reduxForm({
//    form,
//    fields: ['name'],
//    initialValues: {name: 'Tom'},
//    onSubmit: () => Promise.reject({name: deepError})
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  // check before validation
//  expectField({
//    field: stub.props.fields.name,
//    name: 'name',
//    value: 'Tom',
//    initial: 'Tom',
//    valid: true,
//    dirty: false,
//    error: undefined,
//    touched: false,
//    visited: false
//  })
//  return stub.props.handleSubmit()
//    .then(() => {
//      // check state
//      expect(store.getState().form.testForm.name)
//        .toEqual({
//          initial: 'Tom',
//          value: 'Tom',
//          submitError: deepError,
//          touched: true
//        })
//      // check field
//      expectField({
//        field: stub.props.fields.name,
//        name: 'name',
//        value: 'Tom',
//        initial: 'Tom',
//        valid: false,
//        dirty: false,
//        error: deepError,
//        touched: true,
//        visited: false
//      })
//    })
//})
//
//it('should only mutate the field that changed', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['larry', 'moe', 'curly']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  const larry = stub.props.fields.larry
//  const moe = stub.props.fields.moe
//  const curly = stub.props.fields.curly
//
//  moe.onChange('BONK!')
//
//  expect(stub.props.fields.larry).toBe(larry)
//  expect(stub.props.fields.moe).toNotBe(moe)
//  expect(stub.props.fields.curly).toBe(curly)
//})
//
//it('should only change the deep field that changed', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['address.street', 'address.postalCode']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  const address = stub.props.fields.address
//  const street = stub.props.fields.address.street
//  const postalCode = stub.props.fields.address.postalCode
//
//  postalCode.onChange('90210')
//
//  expect(stub.props.fields.address).toNotBe(address)
//  expect(stub.props.fields.address.street).toBe(street)
//  expect(stub.props.fields.address.postalCode).toNotBe(postalCode)
//})
//
//it('should change field tree up to array that changed', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['contact.shipping.phones[]', 'contact.billing.phones[]']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  let contact = stub.props.fields.contact
//  let shipping = stub.props.fields.contact.shipping
//  let shippingPhones = stub.props.fields.contact.shipping.phones
//  const billing = stub.props.fields.contact.billing
//  const billingPhones = stub.props.fields.contact.billing.phones
//
//  shippingPhones.addField()
//
//  expect(stub.props.fields.contact.shipping.phones).toNotBe(shippingPhones)
//  expect(stub.props.fields.contact.shipping).toNotBe(shipping)
//  expect(stub.props.fields.contact).toNotBe(contact)
//  expect(stub.props.fields.contact.billing).toBe(billing)
//  expect(stub.props.fields.contact.billing.phones).toBe(billingPhones)
//
//  contact = stub.props.fields.contact
//  shipping = stub.props.fields.contact.shipping
//  shippingPhones = stub.props.fields.contact.shipping.phones
//  const shippingPhones0 = stub.props.fields.contact.shipping.phones[0]
//
//  shippingPhones[0].onChange('555-1234')
//
//  expect(stub.props.fields.contact.shipping.phones[0]).toNotBe(shippingPhones0)
//  expect(stub.props.fields.contact.shipping.phones).toNotBe(shippingPhones)
//  expect(stub.props.fields.contact.shipping).toNotBe(shipping)
//  expect(stub.props.fields.contact).toNotBe(contact)
//  expect(stub.props.fields.contact.billing).toBe(billing)
//  expect(stub.props.fields.contact.billing.phones).toBe(billingPhones)
//})
//
//it('should provide a submit() method to submit the form', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const initialValues = {firstName: 'Bobby', lastName: 'Tables', age: 12}
//  const onSubmit = createSpy().andReturn(Promise.resolve())
//  const Decorated = reduxForm({
//    form,
//    fields: ['firstName', 'lastName', 'age'],
//    initialValues,
//    onSubmit
//  })(Form)
//
//  class Container extends Component {
//    constructor(props) {
//      super(props)
//      this.submitFromParent = this.submitFromParent.bind(this)
//    }
//
//    submitFromParent() {
//      this.refs.myForm.submit()
//    }
//
//    render() {
//      return (
//        <div>
//          <Decorated ref="myForm"/>
//          <button type="button" onClick={this.submitFromParent}>Submit From Parent</button>
//        </div>
//      )
//    }
//  }
//
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Container/>
//    </Provider>
//  )
//
//  const button = TestUtils.findRenderedDOMComponentWithTag(dom, 'button')
//
//  expect(onSubmit).toNotHaveBeenCalled()
//
//  TestUtils.Simulate.click(button)
//
//  expect(onSubmit)
//    .toHaveBeenCalled()
//    .toHaveBeenCalledWith(initialValues, store.dispatch)
//})
//
//it('submitting from parent should fail if sync validation errors', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const initialValues = {firstName: 'Bobby', lastName: 'Tables', age: 12}
//  const onSubmit = createSpy().andReturn(Promise.resolve())
//  const validate = createSpy().andReturn({firstName: 'Go to your room, Bobby.'})
//  const Decorated = reduxForm({
//    form,
//    fields: ['firstName', 'lastName', 'age'],
//    initialValues,
//    onSubmit,
//    validate
//  })(Form)
//
//  class Container extends Component {
//    constructor(props) {
//      super(props)
//      this.submitFromParent = this.submitFromParent.bind(this)
//    }
//
//    submitFromParent() {
//      this.refs.myForm.submit()
//    }
//
//    render() {
//      return (
//        <div>
//          <Decorated ref="myForm"/>
//          <button type="button" onClick={this.submitFromParent}>Submit From Parent</button>
//        </div>
//      )
//    }
//  }
//
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Container/>
//    </Provider>
//  )
//
//  const button = TestUtils.findRenderedDOMComponentWithTag(dom, 'button')
//
//  expect(onSubmit).toNotHaveBeenCalled()
//
//  TestUtils.Simulate.click(button)
//
//  expect(validate).toHaveBeenCalled()
//  expect(onSubmit).toNotHaveBeenCalled()
//})
//
//it('should only rerender the form that changed', () => {
//  const store = makeStore()
//  const fooRender = createRestorableSpy().andReturn(<div/>)
//  const barRender = createRestorableSpy().andReturn(<div/>)
//
//  class FooForm extends Component {
//    render() {
//      return fooRender()
//    }
//  }
//
//  class BarForm extends Component {
//    render() {
//      return barRender()
//    }
//  }
//
//  const DecoratedFooForm = reduxForm({
//    form: 'foo',
//    fields: ['name']
//  })(FooForm)
//  const DecoratedBarForm = reduxForm({
//    form: 'bar',
//    fields: ['name']
//  })(BarForm)
//
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <div>
//        <DecoratedFooForm/>
//        <DecoratedBarForm/>
//      </div>
//    </Provider>
//  )
//  const fooStub = TestUtils.findRenderedComponentWithType(dom, FooForm)
//
//  // first render
//  expect(fooRender).toHaveBeenCalled()
//  expect(barRender).toHaveBeenCalled()
//
//  // restore spies
//  fooRender.restore()
//  barRender.restore()
//
//  // change field on foo
//  fooStub.props.fields.name.onChange('Tom')
//
//  // second render: only foo form
//  expect(fooRender).toHaveBeenCalled()
//  expect(barRender).toNotHaveBeenCalled()
//})
//
//it('should only rerender the field components that change', () => {
//  const store = makeStore()
//  let fooRenders = 0
//  let barRenders = 0
//
//  class FooInput extends Component {
//    shouldComponentUpdate(nextProps) {
//      return this.props.field !== nextProps.field
//    }
//
//    render() {
//      fooRenders++
//      const {field} = this.props
//      return <input type="text" {...field}/>
//    }
//  }
//  FooInput.propTypes = {
//    field: PropTypes.object.isRequired
//  }
//
//  class BarInput extends Component {
//    shouldComponentUpdate(nextProps) {
//      return this.props.field !== nextProps.field
//    }
//
//    render() {
//      barRenders++
//      const {field} = this.props
//      return <input type="password" {...field}/>
//    }
//  }
//  BarInput.propTypes = {
//    field: PropTypes.object.isRequired
//  }
//
//  class FieldTestForm extends Component {
//    render() {
//      const {fields: {foo, bar}} = this.props
//      return (<div>
//        <FooInput field={foo}/>
//        <BarInput field={bar}/>
//      </div>)
//    }
//  }
//  FieldTestForm.propTypes = {
//    fields: PropTypes.object.isRequired
//  }
//
//  const DecoratedForm = reduxForm({
//    form: 'fieldTest',
//    fields: ['foo', 'bar']
//  })(FieldTestForm)
//
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <DecoratedForm/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, FieldTestForm)
//
//  // first render
//  expect(fooRenders).toBe(1)
//  expect(barRenders).toBe(1)
//
//  // change field foo
//  stub.props.fields.foo.onChange('Tom')
//
//  // second render, only foo should rerender
//  expect(fooRenders).toBe(2)
//  expect(barRenders).toBe(1)
//
//  // change field bar
//  stub.props.fields.bar.onChange('Jerry')
//
//  // third render, only bar should rerender
//  expect(fooRenders).toBe(2)
//  expect(barRenders).toBe(2)
//})

// Test to show bug https://github.com/erikras/redux-form/issues/550
// ---
// It's caused by the fact that we're no longer using the same field instance
// throughout the lifetime of the component. Since the fields are immutable now,
// the field.value given to createOnDragStart() no longer refers to the current
// value.
// ---
//it('should drag the current value', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['name']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  stub.props.fields.name.onChange('FOO')
//  const setData = createSpy()
//  stub.props.fields.name.onDragStart({dataTransfer: {setData}})
//
//  expect(setData)
//    .toHaveBeenCalled()
//    .toHaveBeenCalledWith('value', 'FOO')
//})

// Test to show bug https://github.com/erikras/redux-form/issues/629
// ---
// It's caused by the fact that RESET is just copying values from initial to value,
// but what it needs to do is blow away the whole state tree and re-initialize it
// with the initial values.
// ---
//it('resetting the form should reset array fields', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  const Decorated = reduxForm({
//    form,
//    fields: ['kennel', 'dogs[].name', 'dogs[].breed']
//  })(Form)
//  const dom = TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{
//        kennel: 'Bob\'s Dog House',
//        dogs: [
//          {name: 'Fido', breed: 'Pit Bull'},
//          {name: 'Snoopy', breed: 'Beagle'},
//          {name: 'Scooby Doo', breed: 'Great Dane'}
//        ]
//      }}/>
//    </Provider>
//  )
//  const stub = TestUtils.findRenderedComponentWithType(dom, Form)
//
//  expect(stub.props.fields.dogs.length).toBe(3)
//
//  stub.props.fields.dogs.addField({name: 'Lassie', breed: 'Collie'})
//
//  expect(stub.props.fields.dogs.length).toBe(4)
//
//  stub.props.resetForm()
//
//  expect(stub.props.fields.dogs.length).toBe(3)
//})

// Test to show bug https://github.com/erikras/redux-form/issues/621
// ---
// It's caused by the fact that we are letting the initialValues prop override
// the data from the store for the initialValue and defaultValue props, but NOT for
// value. So the value prop does not get populated until the second render.
// ---
//it('initial values should be present on first render', () => {
//  const store = makeStore()
//  const form = 'testForm'
//  class InitialValuesTestForm extends Component {
//    render() {
//      const {fields: {name}} = this.props
//      expect(name.initialValue).toBe('Bob')
//      expect(name.defaultValue).toBe('Bob')
//      expect(name.value).toBe('Bob')
//      return (<div>
//        <input {...name}/>
//      </div>)
//    }
//  }
//  const Decorated = reduxForm({
//    form,
//    fields: ['name']
//  })(InitialValuesTestForm)
//  TestUtils.renderIntoDocument(
//    <Provider store={store}>
//      <Decorated initialValues={{name: 'Bob'}}/>
//    </Provider>
//  )
//})
describeReduxForm('reduxForm.plain', plain, plainCombineReducers, addExpectations(plainExpectations))
describeReduxForm('reduxForm.immutable', immutable, immutableCombineReducers, addExpectations(immutableExpectations))
